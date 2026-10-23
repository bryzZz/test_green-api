import { isCancel } from 'axios';
import { inspect } from 'node:util';
import { delay, http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { ApiError } from './ApiError';
import { createGreenApiClient } from './createGreenApiClient';

const credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

const base = `${credentials.apiUrl}/waInstance${credentials.idInstance}`;
const token = credentials.apiTokenInstance;

describe('createGreenApiClient errors', () => {
  it.each([
    [400, 'badRequest'],
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rateLimited'],
    [466, 'quota'],
    [500, 'server'],
    [502, 'server'],
  ])('maps HTTP %i to an ApiError of kind %s', async (status, kind) => {
    server.use(
      http.get(`${base}/getStateInstance/${token}`, () =>
        HttpResponse.json({ error: 'nope' }, { status }),
      ),
    );

    const client = createGreenApiClient(credentials);

    const error = await client.getStateInstance().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind, status });
  });
});

describe('createGreenApiClient token safety', () => {
  it('does not expose the API token through a failed request error', async () => {
    server.use(
      http.get(`${base}/getStateInstance/${token}`, () =>
        HttpResponse.json({ error: 'nope' }, { status: 401 }),
      ),
    );

    const client = createGreenApiClient(credentials);

    const error = await client.getStateInstance().catch((e: unknown) => e);

    expect(inspect(error, { depth: null })).not.toContain(token);
  });
});

describe('createGreenApiClient unexpected responses', () => {
  it('maps a response of an unexpected shape to an ApiError of kind server', async () => {
    server.use(
      http.get(`${base}/getStateInstance/${token}`, () =>
        HttpResponse.json({ unexpected: true }),
      ),
    );

    const client = createGreenApiClient(credentials);

    const error = await client.getStateInstance().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server' });
  });

  it('lets an aborted request through without wrapping it', async () => {
    server.use(
      http.get(`${base}/receiveNotification/${token}`, async () => {
        await delay(200);
        return HttpResponse.json(null);
      }),
    );
    const controller = new AbortController();

    const client = createGreenApiClient(credentials);

    const request = client.receiveNotification({ signal: controller.signal });
    controller.abort();
    const error = await request.catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ApiError);
    expect(isCancel(error)).toBe(true);
  });
});

describe('createGreenApiClient network failures', () => {
  it('maps a connection failure to an ApiError of kind network', async () => {
    server.use(
      http.get(`${base}/getStateInstance/${token}`, () => HttpResponse.error()),
    );

    const client = createGreenApiClient(credentials);

    const error = await client.getStateInstance().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network' });
  });

  it('maps a request timeout to an ApiError of kind network', async () => {
    server.use(
      http.get(`${base}/getStateInstance/${token}`, async () => {
        await delay(200);
        return HttpResponse.json({ stateInstance: 'authorized' });
      }),
    );

    const client = createGreenApiClient(credentials, { timeout: 20 });

    const error = await client.getStateInstance().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network' });
  });
});

describe('createGreenApiClient', () => {
  it('getStateInstance calls the instance URL and returns the state', async () => {
    server.use(
      http.get(`${base}/getStateInstance/${token}`, () =>
        HttpResponse.json({ stateInstance: 'authorized' }),
      ),
    );

    const client = createGreenApiClient(credentials);

    await expect(client.getStateInstance()).resolves.toEqual({
      stateInstance: 'authorized',
    });
  });

  it('sendMessage posts chatId and message and returns the message id', async () => {
    let body: unknown;
    server.use(
      http.post(`${base}/sendMessage/${token}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ idMessage: 'BAE5367237E13A87' });
      }),
    );

    const client = createGreenApiClient(credentials);

    await expect(
      client.sendMessage({ chatId: '10000000', message: 'Hello' }),
    ).resolves.toEqual({ idMessage: 'BAE5367237E13A87' });
    expect(body).toEqual({ chatId: '10000000', message: 'Hello' });
  });

  it('getSettings returns the webhook settings and ignores the rest', async () => {
    server.use(
      http.get(`${base}/getSettings/${token}`, () =>
        HttpResponse.json({
          wid: '79990000000@c.us',
          webhookUrl: '',
          delaySendMessagesMilliseconds: 1000,
          incomingWebhook: 'yes',
          outgoingWebhook: 'no',
          outgoingMessageWebhook: 'yes',
          outgoingAPIMessageWebhook: 'yes',
        }),
      ),
    );

    const client = createGreenApiClient(credentials);

    await expect(client.getSettings()).resolves.toEqual({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'no',
      outgoingMessageWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
    });
  });

  it('receiveNotification returns null when the queue is empty', async () => {
    let timeout: string | null = null;
    server.use(
      http.get(`${base}/receiveNotification/${token}`, ({ request }) => {
        timeout = new URL(request.url).searchParams.get('receiveTimeout');
        return HttpResponse.json(null);
      }),
    );

    const client = createGreenApiClient(credentials);

    await expect(
      client.receiveNotification({ receiveTimeout: 20 }),
    ).resolves.toBeNull();
    expect(timeout).toBe('20');
  });

  it('receiveNotification returns the receipt id with a parsed event', async () => {
    server.use(
      http.get(`${base}/receiveNotification/${token}`, () =>
        HttpResponse.json({
          receiptId: 1234,
          body: {
            typeWebhook: 'outgoingMessageStatus',
            idMessage: 'BAE5367237E13A87',
            chatId: '10000000',
            status: 'delivered',
          },
        }),
      ),
    );

    const client = createGreenApiClient(credentials);

    await expect(client.receiveNotification()).resolves.toEqual({
      receiptId: 1234,
      event: {
        type: 'status',
        idMessage: 'BAE5367237E13A87',
        chatId: '10000000',
        status: 'delivered',
      },
    });
  });

  it('deleteNotification removes the notification by receipt id', async () => {
    server.use(
      http.delete(`${base}/deleteNotification/${token}/1234`, () =>
        HttpResponse.json({ result: true }),
      ),
    );

    const client = createGreenApiClient(credentials);

    await expect(client.deleteNotification(1234)).resolves.toBeUndefined();
  });

  it('checkAccount resolves a phone number to a chat id', async () => {
    let body: unknown;
    server.use(
      http.post(`${base}/checkAccount/${token}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ exist: true, chatId: '10000000' });
      }),
    );

    const client = createGreenApiClient(credentials);

    await expect(client.checkAccount(79991234567)).resolves.toEqual({
      exist: true,
      chatId: '10000000',
    });
    expect(body).toEqual({ phoneNumber: 79991234567 });
  });

  it('checkAccount reports a number that is not registered', async () => {
    server.use(
      http.post(`${base}/checkAccount/${token}`, () =>
        HttpResponse.json({ exist: false }),
      ),
    );

    const client = createGreenApiClient(credentials);

    await expect(client.checkAccount(79990000000)).resolves.toEqual({
      exist: false,
    });
  });
});
