import { createGreenApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import { server } from '../test/server';
import { createFakeGreenApi } from './fake-green-api';

const credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

const fastTimings = {
  deliveredDelayMs: 10,
  readDelayMs: 30,
  echoDelayMs: 60,
  maxHoldMs: 500,
};

function setup(
  options: Parameters<typeof createFakeGreenApi>[0] = fastTimings,
) {
  const fake = createFakeGreenApi(options);
  server.use(...fake.handlers);
  return { fake, client: createGreenApiClient(credentials) };
}

type Client = ReturnType<typeof createGreenApiClient>;

// Reads and deletes `count` notifications, like the polling loop does.
async function drain(client: Client, count: number) {
  const events = [];
  while (events.length < count) {
    const received = await client.receiveNotification({ receiveTimeout: 5 });
    if (!received) continue;
    events.push(received.event);
    await client.deleteNotification(received.receiptId);
  }
  return events;
}

describe('fake GREEN-API robustness', () => {
  it('gives different numbers different chat ids even when their tails match', async () => {
    const { client } = setup();

    const first = await client.checkAccount(79991234567);
    const second = await client.checkAccount(77791234567);

    expect(second.chatId).not.toBe(first.chatId);
  });

  it('rejects a send without a chat id and does not spend quota on it', async () => {
    const { client } = setup();

    const error = await client
      .sendMessage({ chatId: '', message: 'Hi' })
      .catch((e: unknown) => e);
    for (const chatId of ['10000001', '10000002', '10000003']) {
      await client.sendMessage({ chatId, message: 'Hi' });
    }

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'badRequest' });
  });

  it('rejects a checkAccount request without a phone number', async () => {
    setup();

    const response = await fetch(
      `${credentials.apiUrl}/waInstance${credentials.idInstance}/checkAccount/${credentials.apiTokenInstance}`,
      { method: 'POST', body: JSON.stringify({}) },
    );

    expect(response.status).toBe(400);
  });

  it('stops simulating the recipient after dispose', async () => {
    const { fake, client } = setup();

    await client.sendMessage({ chatId: '10000000', message: 'Hello' });
    fake.dispose();
    const events = await drain(client, 1);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const leftover = await client.receiveNotification({ receiveTimeout: 5 });

    expect(events).toHaveLength(1);
    expect(leftover).toBeNull();
  });
});

describe('fake GREEN-API instance', () => {
  it('is authorized with webhooks configured for the HTTP API', async () => {
    const { client } = setup();

    await expect(client.getStateInstance()).resolves.toEqual({
      stateInstance: 'authorized',
    });
    await expect(client.getSettings()).resolves.toEqual({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
    });
  });
});

describe('fake GREEN-API sending', () => {
  it('gives every sent message its own id', async () => {
    const { client } = setup();

    const first = await client.sendMessage({
      chatId: '10000000',
      message: 'a',
    });
    const second = await client.sendMessage({
      chatId: '10000000',
      message: 'b',
    });

    expect(first.idMessage).toEqual(expect.any(String));
    expect(second.idMessage).not.toBe(first.idMessage);
  });
});

describe('fake GREEN-API echo bot', () => {
  it('confirms the send, reports delivered and read, then echoes the text back', async () => {
    const { client } = setup();

    const { idMessage } = await client.sendMessage({
      chatId: '10000000',
      message: 'Hello',
    });
    const events = await drain(client, 4);

    expect(events).toMatchObject([
      {
        type: 'message',
        direction: 'outgoing',
        idMessage,
        chatId: '10000000',
        content: { kind: 'text', text: 'Hello' },
      },
      { type: 'status', idMessage, chatId: '10000000', status: 'delivered' },
      { type: 'status', idMessage, chatId: '10000000', status: 'read' },
      {
        type: 'message',
        direction: 'incoming',
        chatId: '10000000',
        content: { kind: 'text', text: 'Hello' },
      },
    ]);
  });
});

describe('fake GREEN-API notification queue', () => {
  it('answers null when nothing arrives before the hold time runs out', async () => {
    const { client } = setup({ ...fastTimings, maxHoldMs: 20 });

    await expect(
      client.receiveNotification({ receiveTimeout: 5 }),
    ).resolves.toBeNull();
  });

  it('keeps delivering a notification until it is deleted', async () => {
    const { client } = setup();
    await client.sendMessage({ chatId: '10000000', message: 'Hello' });

    const first = await client.receiveNotification({ receiveTimeout: 5 });
    const again = await client.receiveNotification({ receiveTimeout: 5 });
    await client.deleteNotification(first!.receiptId);
    const next = await client.receiveNotification({ receiveTimeout: 5 });

    expect(again?.receiptId).toBe(first?.receiptId);
    expect(next?.receiptId).not.toBe(first?.receiptId);
  });
});

describe('fake GREEN-API failures', () => {
  it.each([
    ['network', 'network'],
    ['server', 'server'],
  ] as const)(
    'simulates a %s failure and recovers when switched off',
    async (failure, kind) => {
      const { fake, client } = setup();

      fake.setFailure(failure);
      const error = await client.getStateInstance().catch((e: unknown) => e);
      fake.setFailure(null);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind });
      await expect(client.getStateInstance()).resolves.toEqual({
        stateInstance: 'authorized',
      });
    },
  );
});

describe('fake GREEN-API quota', () => {
  it('rejects the fourth new chat but keeps serving existing ones', async () => {
    const { client } = setup();
    for (const chatId of ['10000001', '10000002', '10000003']) {
      await client.sendMessage({ chatId, message: 'Hi' });
    }

    const error = await client
      .sendMessage({ chatId: '10000004', message: 'Hi' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'quota' });
    await expect(
      client.sendMessage({ chatId: '10000001', message: 'Again' }),
    ).resolves.toEqual({ idMessage: expect.any(String) });
  });
});

describe('fake GREEN-API account', () => {
  it('reports numbers ending in 0000 as not registered', async () => {
    const { client } = setup();

    await expect(client.checkAccount(79990000000)).resolves.toEqual({
      exist: false,
    });
  });

  it('resolves other numbers to a stable numeric chat id', async () => {
    const { client } = setup();

    const first = await client.checkAccount(79991234567);
    const second = await client.checkAccount(79991234567);
    const other = await client.checkAccount(79997654321);

    expect(first.exist).toBe(true);
    expect(first.chatId).toMatch(/^\d+$/);
    expect(second).toEqual(first);
    expect(other.chatId).not.toBe(first.chatId);
  });
});
