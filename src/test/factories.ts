import type { Credentials } from '@/api/createGreenApiClient';
import type { NotificationEvent } from '@/api/parseNotification';
import type { Chat, Message } from '@/features/chats/store/types';

export const credentials: Credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

/**
 * The same credentials over plain http. For https MSW emulates a TLS socket,
 * and aborting a request in flight (the polling loop does it whenever its
 * screen is closed) makes that emulation throw an unrelated error inside
 * whichever test happens to run next. Use these in tests that poll.
 */
export const httpCredentials: Credentials = {
  ...credentials,
  apiUrl: 'http://api.green-api.com',
};

export const DAY = 24 * 60 * 60;

/** Today at 19:10 local time (unix seconds), whatever day the tests run on. */
export const todayAt1910 = new Date().setHours(19, 10, 0, 0) / 1000;

type MessageEvent = Extract<NotificationEvent, { type: 'message' }>;

/** A text message from someone else, as the notification queue delivers it. */
export const incoming = (
  overrides: Partial<MessageEvent> = {},
): MessageEvent => ({
  type: 'message',
  direction: 'incoming',
  idMessage: 'A1',
  chatId: '10000000',
  chatName: 'Ivan',
  timestamp: 1700000000,
  content: { kind: 'text', text: 'Hi' },
  ...overrides,
});

/** A stored message: incoming, plain text, today at 19:10. */
export const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  idMessage: 'm1',
  direction: 'incoming',
  content: { kind: 'text', text: 'Привет' },
  timestamp: todayAt1910,
  ...overrides,
});

/** A stored chat with one incoming message. */
export const chat = (overrides: Partial<Chat> = {}): Chat => ({
  chatId: '10000001',
  name: 'Иван Петров',
  createdAt: todayAt1910,
  messages: [message()],
  ...overrides,
});
