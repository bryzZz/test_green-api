import { delay, http, HttpResponse } from 'msw';
import { createGreenApiClient } from '@/api/createGreenApiClient';
import type { NotificationEvent } from '@/api/parseNotification';
import { createFakeGreenApi } from '@/mocks/createFakeGreenApi';
import { httpCredentials as credentials } from '@/test/factories';
import { server } from '@/test/server';
import { runPolling } from './runPolling';

const receiveUrl = '*/waInstance:id/receiveNotification/:token';
const deleteUrl = '*/waInstance:id/deleteNotification/:token/:receiptId';

const fast = {
  deliveredDelayMs: 10,
  readDelayMs: 30,
  echoDelayMs: 60,
  maxHoldMs: 100,
};

const startLoop = (
  options: {
    backoff?: { initialMs: number; maxMs: number };
    onEvent?: (event: NotificationEvent) => void;
  } = {},
) => {
  const controller = new AbortController();
  const events: NotificationEvent[] = [];
  const connection: boolean[] = [];
  const onUnauthorized = vi.fn();
  const onEventError = vi.fn();

  const done = runPolling({
    client: createGreenApiClient(credentials),
    onEvent: options.onEvent ?? ((event) => events.push(event)),
    onEventError,
    onConnectionChange: (connected) => connection.push(connected),
    onUnauthorized,
    signal: controller.signal,
    receiveTimeout: 1,
    healthyAfterMs: 100,
    backoff: options.backoff ?? { initialMs: 20, maxMs: 80 },
  });

  return {
    events,
    connection,
    onUnauthorized,
    onEventError,
    done,
    stop: async () => {
      controller.abort();
      await done;
    },
  };
};

describe('runPolling delivery', () => {
  it('hands over what the queue holds, in order, and deletes it', async () => {
    const fake = createFakeGreenApi(fast);
    server.use(...fake.handlers);
    const client = createGreenApiClient(credentials);
    const loop = startLoop();

    await client.sendMessage({ chatId: '10000001', message: 'Hello' });

    await vi.waitFor(() => expect(loop.events).toHaveLength(4));
    await loop.stop();
    expect(loop.events).toMatchObject([
      { type: 'message', direction: 'outgoing' },
      { type: 'status', status: 'delivered' },
      { type: 'status', status: 'read' },
      { type: 'message', direction: 'incoming' },
    ]);
    // Everything was deleted, so the queue is empty now.
    await expect(
      client.receiveNotification({ receiveTimeout: 1 }),
    ).resolves.toBeNull();
  });

  it('keeps polling while the queue is empty and picks up what comes later', async () => {
    server.use(...createFakeGreenApi(fast).handlers);
    const client = createGreenApiClient(credentials);
    const loop = startLoop();

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(loop.events).toEqual([]);
    await client.sendMessage({ chatId: '10000001', message: 'Later' });

    await vi.waitFor(() => expect(loop.events.length).toBeGreaterThan(0));
    await loop.stop();
  });

  it('deletes notifications it has no use for, without passing them on', async () => {
    const deleted: string[] = [];
    const queue = [
      { receiptId: 1, body: { typeWebhook: 'stateInstanceChanged' } },
      {
        receiptId: 2,
        body: {
          typeWebhook: 'incomingMessageReceived',
          timestamp: 1700000000,
          idMessage: 'A1',
          senderData: { chatId: '10000001', sender: '10000001' },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'Hi' },
          },
        },
      },
    ];
    server.use(
      http.get(receiveUrl, async () => {
        if (queue.length === 0) await delay(50);
        return HttpResponse.json(queue[0] ?? null);
      }),
      http.delete(deleteUrl, ({ params }) => {
        deleted.push(String(params.receiptId));
        queue.shift();
        return HttpResponse.json({ result: true });
      }),
    );
    const loop = startLoop();

    await vi.waitFor(() => expect(deleted).toEqual(['1', '2']));
    await loop.stop();
    expect(loop.events).toHaveLength(1);
    expect(loop.events[0]).toMatchObject({ type: 'message', idMessage: 'A1' });
  });
});

describe('runPolling a notification that cannot be handled', () => {
  it('reports it, removes it from the queue and carries on with the next one', async () => {
    const incoming = (receiptId: number, idMessage: string) => ({
      receiptId,
      body: {
        typeWebhook: 'incomingMessageReceived',
        timestamp: 1700000000,
        idMessage,
        senderData: { chatId: '10000001', sender: '10000001' },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: 'Hi' },
        },
      },
    });
    const queue = [incoming(1, 'BAD'), incoming(2, 'GOOD')];
    const deleted: string[] = [];
    server.use(
      http.get(receiveUrl, async () => {
        if (queue.length === 0) await delay(50);
        return HttpResponse.json(queue[0] ?? null);
      }),
      http.delete(deleteUrl, ({ params }) => {
        deleted.push(String(params.receiptId));
        queue.shift();
        return HttpResponse.json({ result: true });
      }),
    );
    const handled: string[] = [];
    const loop = startLoop({
      onEvent: (event) => {
        if (event.type === 'message' && event.idMessage === 'BAD') {
          throw new Error('cannot handle this');
        }
        if (event.type === 'message') handled.push(event.idMessage);
      },
    });

    await vi.waitFor(() => expect(deleted).toEqual(['1', '2']));
    await loop.stop();

    expect(handled).toEqual(['GOOD']);
    expect(loop.onEventError).toHaveBeenCalledWith(expect.any(Error));
    expect(loop.connection).toEqual([]); // a bug of ours is not a lost connection
  });
});

describe('runPolling failures', () => {
  it('waits longer after each failure, up to a limit', async () => {
    const times: number[] = [];
    server.use(
      http.get(receiveUrl, () => {
        times.push(Date.now());
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const loop = startLoop({ backoff: { initialMs: 30, maxMs: 120 } });

    await vi.waitFor(() => expect(times.length).toBeGreaterThanOrEqual(5), {
      timeout: 2000,
    });
    await loop.stop();

    const gaps = times.slice(1).map((time, i) => time - times[i]);
    // The waits are 30, 60, 120, 120 ms; timers and clocks are not exact, so
    // the lower bounds leave some room.
    expect(gaps[0]).toBeGreaterThanOrEqual(25);
    expect(gaps[1]).toBeGreaterThanOrEqual(52);
    expect(gaps[2]).toBeGreaterThanOrEqual(105);
    expect(gaps[3]).toBeGreaterThanOrEqual(105);
    expect(gaps[3]).toBeLessThan(120 * 3); // capped, not still doubling
  });

  it.each([
    ['a lost connection', () => HttpResponse.error()],
    ['a server error', () => HttpResponse.json({}, { status: 500 })],
    ['rate limiting', () => HttpResponse.json({}, { status: 429 })],
  ])(
    'reports the connection lost after %s and back once it works again',
    async (_name, fail) => {
      let broken = true;
      server.use(...createFakeGreenApi(fast).handlers);
      // Answers only while broken; otherwise the fake API above takes over.
      server.use(http.get(receiveUrl, () => (broken ? fail() : undefined)));
      const loop = startLoop();

      await vi.waitFor(() => expect(loop.connection).toEqual([false]));
      broken = false;

      await vi.waitFor(() => expect(loop.connection).toEqual([false, true]), {
        timeout: 2000,
      });
      await loop.stop();
    },
  );

  it('counts the connection as back while the server holds a request, without waiting for the answer', async () => {
    let broken = true;
    server.use(
      http.get(receiveUrl, async () => {
        if (broken) return HttpResponse.error();
        await delay('infinite'); // an empty queue held by the server
        return HttpResponse.json(null);
      }),
    );
    const loop = startLoop();
    await vi.waitFor(() => expect(loop.connection).toEqual([false]));

    broken = false;

    await vi.waitFor(() => expect(loop.connection).toEqual([false, true]), {
      timeout: 1000,
    });
    await loop.stop();
  });

  it('does not wait out the pause when the browser comes back online', async () => {
    let broken = true;
    server.use(...createFakeGreenApi(fast).handlers);
    server.use(
      http.get(receiveUrl, () => (broken ? HttpResponse.error() : undefined)),
    );
    const loop = startLoop({ backoff: { initialMs: 60_000, maxMs: 60_000 } });
    await vi.waitFor(() => expect(loop.connection).toEqual([false]));

    broken = false;
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(loop.connection).toEqual([false, true]), {
      timeout: 1000,
    });
    await loop.stop();
  });

  it('retries a notification that could not be deleted and delivers it at least once', async () => {
    let failDelete = true;
    server.use(...createFakeGreenApi(fast).handlers);
    server.use(
      http.delete(deleteUrl, () =>
        failDelete ? HttpResponse.error() : undefined,
      ),
    );
    const client = createGreenApiClient(credentials);
    const loop = startLoop();
    await client.sendMessage({ chatId: '10000001', message: 'Hi' });

    await vi.waitFor(() => expect(loop.connection).toEqual([false]));
    failDelete = false;

    await vi.waitFor(() => expect(loop.connection).toEqual([false, true]), {
      timeout: 2000,
    });
    await vi.waitFor(() =>
      expect(loop.events.length).toBeGreaterThanOrEqual(4),
    );
    await loop.stop();
  });
});

describe('runPolling stopping', () => {
  it.each([401, 403])(
    'stops and says so when GREEN-API answers %i',
    async (status) => {
      let requests = 0;
      server.use(
        http.get(receiveUrl, () => {
          requests += 1;
          return HttpResponse.json({}, { status });
        }),
      );
      const loop = startLoop();

      await loop.done;
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(loop.onUnauthorized).toHaveBeenCalledTimes(1);
      expect(requests).toBe(1);
    },
  );

  it('stops at once when aborted during a pause after a failure', async () => {
    server.use(http.get(receiveUrl, () => HttpResponse.error()));
    const loop = startLoop({ backoff: { initialMs: 60_000, maxMs: 60_000 } });
    await vi.waitFor(() => expect(loop.connection).toEqual([false]));

    const started = Date.now();
    await loop.stop();

    expect(Date.now() - started).toBeLessThan(500);
  });

  it('makes no requests after it was stopped', async () => {
    let requests = 0;
    server.use(
      http.get(receiveUrl, async () => {
        requests += 1;
        await delay(20);
        return HttpResponse.json(null);
      }),
    );
    const loop = startLoop();
    await vi.waitFor(() => expect(requests).toBeGreaterThan(1));
    await loop.stop();
    const after = requests;

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(requests).toBe(after);
  });

  it('stops at once when aborted in the middle of a request', async () => {
    server.use(
      http.get(receiveUrl, async () => {
        await delay('infinite');
        return HttpResponse.json(null);
      }),
    );
    const loop = startLoop();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const started = Date.now();
    await loop.stop();

    expect(Date.now() - started).toBeLessThan(500);
  });
});
