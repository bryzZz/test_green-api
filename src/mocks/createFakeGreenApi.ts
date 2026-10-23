import { http, HttpResponse, type HttpResponseResolver } from 'msw';
import { nowSeconds } from '@/shared/lib/time';
import { createNotificationQueue } from './createNotificationQueue';

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

const badRequest = () =>
  HttpResponse.json({ error: 'bad request' }, { status: 400 });

/**
 * A GREEN-API that answers in memory: numbers ending in 0000 are not in MAX,
 * a sent message is echoed back after a while (with delivered and read marks
 * on the way), and the Developer tariff's limit of chats applies. Hand its
 * `handlers` to MSW, in tests and in the browser (`pnpm dev:mock`).
 */
export const createFakeGreenApi = ({
  deliveredDelayMs = 300,
  readDelayMs = 1000,
  echoDelayMs = 2000,
  maxHoldMs = Infinity,
  chatQuota = 3,
}: FakeGreenApiOptions = {}) => {
  let messageCounter = 0;
  let failure: FakeFailure = null;
  const chats = new Set<string>();
  // Like in MAX, a chat id is unrelated to the phone number it belongs to.
  const chatIdByPhone = new Map<number, string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const queue = createNotificationQueue();

  const chatIdFor = (phoneNumber: number) => {
    const known = chatIdByPhone.get(phoneNumber);
    if (known) return known;

    const chatId = String(10_000_001 + chatIdByPhone.size);
    chatIdByPhone.set(phoneNumber, chatId);
    return chatId;
  };

  const schedule = (callback: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
  };

  const enqueueStatus = (
    chatId: string,
    idMessage: string,
    status: 'delivered' | 'read',
  ) =>
    queue.enqueue({
      typeWebhook: 'outgoingMessageStatus',
      timestamp: nowSeconds(),
      idMessage,
      chatId,
      status,
    });

  const enqueueEcho = (chatId: string, text: string) => {
    messageCounter += 1;
    queue.enqueue({
      typeWebhook: 'incomingMessageReceived',
      timestamp: nowSeconds(),
      idMessage: `FAKE${messageCounter}`,
      senderData: { chatId, sender: chatId },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: text },
      },
    });
  };

  const simulateRecipient = (
    chatId: string,
    idMessage: string,
    text: string,
  ) => {
    schedule(
      () => enqueueStatus(chatId, idMessage, 'delivered'),
      deliveredDelayMs,
    );
    schedule(() => enqueueStatus(chatId, idMessage, 'read'), readDelayMs);
    schedule(() => enqueueEcho(chatId, text), echoDelayMs);
  };

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

  const handleCheckAccount: HttpResponseResolver = async ({ request }) => {
    const { phoneNumber } = (await request.json()) as { phoneNumber?: unknown };
    if (typeof phoneNumber !== 'number') return badRequest();
    if (String(phoneNumber).endsWith('0000')) {
      return HttpResponse.json({ exist: false });
    }
    return HttpResponse.json({ exist: true, chatId: chatIdFor(phoneNumber) });
  };

  const handleSendMessage: HttpResponseResolver = async ({ request }) => {
    const { chatId, message } = (await request.json()) as {
      chatId?: unknown;
      message?: unknown;
    };
    if (typeof chatId !== 'string' || chatId === '') return badRequest();
    if (typeof message !== 'string') return badRequest();

    const isNewChat = !chats.has(chatId);
    if (isNewChat && chats.size >= chatQuota) {
      return HttpResponse.json({ error: 'quota exceeded' }, { status: 466 });
    }
    chats.add(chatId);

    messageCounter += 1;
    const idMessage = `FAKE${messageCounter}`;
    queue.enqueue({
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
  };

  const handleReceiveNotification: HttpResponseResolver = async ({
    request,
  }) => {
    if (queue.isEmpty()) {
      const { searchParams } = new URL(request.url);
      const receiveTimeout = Number(searchParams.get('receiveTimeout') ?? 5);
      await queue.waitForNotification(
        Math.min(receiveTimeout * 1000, maxHoldMs),
        request.signal,
      );
    }
    // A failure switched on while this request was held breaks it too, as a
    // dropped connection would.
    return failureResponse() ?? HttpResponse.json(queue.first() ?? null);
  };

  const handleDeleteNotification: HttpResponseResolver = ({ params }) =>
    HttpResponse.json({ result: queue.remove(Number(params.receiptId)) });

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
    post(route('checkAccount'), handleCheckAccount),
    post(route('sendMessage'), handleSendMessage),
    get(route('receiveNotification'), handleReceiveNotification),
    del(`${route('deleteNotification')}/:receiptId`, handleDeleteNotification),
  ];

  const setFailure = (next: FakeFailure) => {
    failure = next;
    if (next) queue.wakeWaiters();
  };

  /** Cancels the pending recipient simulation (delivered, read, echo). */
  const dispose = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };

  return { handlers, setFailure, dispose };
};
