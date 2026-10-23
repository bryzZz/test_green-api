import type { NotificationEvent } from '@/api/parseNotification';
import type { ChatsState, Message } from './types';

type MessageEvent = Extract<NotificationEvent, { type: 'message' }>;

const byTime = (a: Message, b: Message) => a.timestamp - b.timestamp;

const toMessage = (event: MessageEvent): Message => ({
  id: event.idMessage,
  idMessage: event.idMessage,
  direction: event.direction,
  content: event.content,
  timestamp: event.timestamp,
  ...(event.direction === 'outgoing' && { status: 'sent' as const }),
});

/**
 * The index of the message of ours that this echo belongs to, or -1. Such a
 * message may still be shown as pending or failed (e.g. the request timed out
 * although the server accepted it).
 */
const findOwnMessageIndex = (messages: Message[], event: MessageEvent) => {
  if (event.direction !== 'outgoing' || event.content.kind !== 'text') {
    return -1;
  }
  const { text } = event.content;

  return messages.findIndex(
    (message) =>
      !message.idMessage &&
      (message.status === 'pending' || message.status === 'failed') &&
      message.content.kind === 'text' &&
      message.content.text === text,
  );
};

/** A message that came in, or went out from another device or through the API. */
export const applyMessageEvent = (
  state: ChatsState,
  event: MessageEvent,
): Partial<ChatsState> => {
  const chat = state.chats[event.chatId] ?? {
    chatId: event.chatId,
    name: event.chatName,
    createdAt: event.timestamp,
    messages: [],
  };
  if (chat.messages.some((message) => message.idMessage === event.idMessage)) {
    return state;
  }

  // Adopt the echo of a message we sent from here instead of adding a copy.
  const ownIndex = findOwnMessageIndex(chat.messages, event);
  const messages =
    ownIndex === -1
      ? [...chat.messages, toMessage(event)].sort(byTime)
      : chat.messages.map((message, index) =>
          index === ownIndex
            ? {
                ...message,
                idMessage: event.idMessage,
                status: 'sent' as const,
                errorKind: undefined,
              }
            : message,
        );

  return {
    chats: {
      ...state.chats,
      [event.chatId]: { ...chat, name: chat.name ?? event.chatName, messages },
    },
  };
};
