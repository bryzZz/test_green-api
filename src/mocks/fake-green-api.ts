import { http, HttpResponse, type HttpResponseResolver } from 'msw';

// Paths are matched on any host: the user enters `apiUrl` on the login screen.
const route = (method: string) => `*/waInstance:instance/${method}/:token`;

const OWN_WID = '70000000000@c.us';

export type FakeFailure = 'network' | 'server' | null;

export type FakeGreenApiOptions = {
  deliveredDelayMs?: number;
  readDelayMs?: number;
  echoDelayMs?: number;
  /** Upper bound for how long `receiveNotification` holds an empty queue. */
  maxHoldMs?: number;
  /** Chats a new chat may be started with (Developer tariff: 3). */
  chatQuota?: number;
};

type QueuedNotification = { receiptId: number; body: unknown };

const badRequest = () =>
  HttpResponse.json({ error: 'bad request' }, { status: 400 });

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function createFakeGreenApi({
  deliveredDelayMs = 300,
  readDelayMs = 1000,
  echoDelayMs = 2000,
  maxHoldMs = Infinity,
  chatQuota = 3,
}: FakeGreenApiOptions = {}) {
  let messageCounter = 0;
  let receiptCounter = 0;
  const chats = new Set<string>();
  // Like in MAX, a chat id is unrelated to the phone number it belongs to.
  const chatIdByPhone = new Map<number, string>();
  const queue: QueuedNotification[] = [];
  const waiters = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function chatIdFor(phoneNumber: number) {
    let chatId = chatIdByPhone.get(phoneNumber);
    if (!chatId) {
      chatId = String(10_000_001 + chatIdByPhone.size);
      chatIdByPhone.set(phoneNumber, chatId);
    }
    return chatId;
  }

  function schedule(callback: () => void, delayMs: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
  }

  function enqueue(body: unknown) {
    receiptCounter += 1;
    queue.push({ receiptId: receiptCounter, body });
    for (const wake of waiters) wake();
  }

  // Like the real API, an empty queue holds the request until something
  // arrives or `receiveTimeout` runs out.
  function waitForNotification(holdMs: number, signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const done = () => {
        clearTimeout(timer);
        waiters.delete(done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, holdMs);
      waiters.add(done);
      signal.addEventListener('abort', done);
    });
  }

  function simulateRecipient(chatId: string, idMessage: string, text: string) {
    schedule(
      () =>
        enqueue({
          typeWebhook: 'outgoingMessageStatus',
          timestamp: nowSeconds(),
          idMessage,
          chatId,
          status: 'delivered',
        }),
      deliveredDelayMs,
    );
    schedule(
      () =>
        enqueue({
          typeWebhook: 'outgoingMessageStatus',
          timestamp: nowSeconds(),
          idMessage,
          chatId,
          status: 'read',
        }),
      readDelayMs,
    );
    schedule(() => {
      messageCounter += 1;
      enqueue({
        typeWebhook: 'incomingMessageReceived',
        timestamp: nowSeconds(),
        idMessage: `FAKE${messageCounter}`,
        senderData: { chatId, sender: chatId },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: text },
        },
      });
    }, echoDelayMs);
  }

  let failure: FakeFailure = null;

  const failureResponse = () => {
    if (failure === 'network') return HttpResponse.error();
    if (failure === 'server') {
      return HttpResponse.json({ error: 'fake server error' }, { status: 500 });
    }
    return undefined;
  };

  // Every endpoint goes through this guard, so one switch breaks them all.
  const guard =
    (resolver: HttpResponseResolver): HttpResponseResolver =>
    (info) =>
      failureResponse() ?? resolver(info);
  const get = (path: string, resolver: HttpResponseResolver) =>
    http.get(path, guard(resolver));
  const post = (path: string, resolver: HttpResponseResolver) =>
    http.post(path, guard(resolver));
  const del = (path: string, resolver: HttpResponseResolver) =>
    http.delete(path, guard(resolver));

  const handlers = [
    get(route('getStateInstance'), () =>
      HttpResponse.json({ stateInstance: 'authorized' }),
    ),

    get(route('getSettings'), () =>
      HttpResponse.json({
        webhookUrl: '',
        incomingWebhook: 'yes',
        outgoingWebhook: 'yes',
        outgoingMessageWebhook: 'yes',
        outgoingAPIMessageWebhook: 'yes',
      }),
    ),

    post(route('checkAccount'), async ({ request }) => {
      const { phoneNumber } = (await request.json()) as {
        phoneNumber?: unknown;
      };
      if (typeof phoneNumber !== 'number') return badRequest();
      if (String(phoneNumber).endsWith('0000')) {
        return HttpResponse.json({ exist: false });
      }
      return HttpResponse.json({
        exist: true,
        chatId: chatIdFor(phoneNumber),
      });
    }),

    post(route('sendMessage'), async ({ request }) => {
      const { chatId, message } = (await request.json()) as {
        chatId?: unknown;
        message?: unknown;
      };
      if (typeof chatId !== 'string' || chatId === '') return badRequest();
      if (typeof message !== 'string') return badRequest();
      if (!chats.has(chatId)) {
        if (chats.size >= chatQuota) {
          return HttpResponse.json(
            { error: 'quota exceeded' },
            { status: 466 },
          );
        }
        chats.add(chatId);
      }
      messageCounter += 1;
      const idMessage = `FAKE${messageCounter}`;

      enqueue({
        typeWebhook: 'outgoingAPIMessageReceived',
        timestamp: nowSeconds(),
        idMessage,
        senderData: { chatId, sender: OWN_WID },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: message },
        },
      });
      simulateRecipient(chatId, idMessage, message);

      return HttpResponse.json({ idMessage });
    }),

    get(route('receiveNotification'), async ({ request }) => {
      if (queue.length === 0) {
        const url = new URL(request.url);
        const receiveTimeout = Number(
          url.searchParams.get('receiveTimeout') ?? 5,
        );
        await waitForNotification(
          Math.min(receiveTimeout * 1000, maxHoldMs),
          request.signal,
        );
      }
      // A failure switched on while this request was held breaks it too, as a
      // dropped connection would.
      return failureResponse() ?? HttpResponse.json(queue[0] ?? null);
    }),

    del(`${route('deleteNotification')}/:receiptId`, ({ params }) => {
      const index = queue.findIndex(
        (item) => item.receiptId === Number(params.receiptId),
      );
      if (index !== -1) queue.splice(index, 1);
      return HttpResponse.json({ result: index !== -1 });
    }),
  ];

  return {
    handlers,
    setFailure(next: FakeFailure) {
      failure = next;
      if (next) for (const wake of waiters) wake();
    },
    /** Cancels the pending recipient simulation (delivered, read, echo). */
    dispose() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}
