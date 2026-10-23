import type { ApiErrorKind } from '@/api/ApiError';
import { forwardStatus } from './messageStatus';
import type { ChatsState, Message } from './types';
import { updateChat } from './updateChat';

/** Shows a message the user has just written, before the API has answered. */
export const appendPendingMessage = (
  state: ChatsState,
  chatId: string,
  message: Message,
): Partial<ChatsState> => {
  const chat = state.chats[chatId] ?? {
    chatId,
    createdAt: message.timestamp,
    messages: [],
  };

  return {
    chats: {
      ...state.chats,
      [chatId]: {
        ...chat,
        messages: [...chat.messages, message],
        // Writing back means the user has seen what is above.
        lastReadId: message.id,
      },
    },
  };
};

/** The API accepted the message and gave it an id. */
export const confirmPendingMessage = (
  state: ChatsState,
  chatId: string,
  localId: string,
  idMessage: string,
): Partial<ChatsState> =>
  updateChat(state, chatId, (chat) => {
    // The API echo (or even its statuses) may have arrived before the send
    // response: keep the local entry, which the UI already renders, and take
    // over whatever the echo has learned.
    const echo = chat.messages.find(
      (message) => message.idMessage === idMessage && message.id !== localId,
    );
    const messages = chat.messages
      .filter((message) => message !== echo)
      .map((message) =>
        message.id === localId
          ? {
              ...message,
              idMessage,
              status: forwardStatus(message.status, echo?.status ?? 'sent'),
            }
          : message,
      );
    // The echo may have been the read marker: it moves to the entry that took
    // its place.
    const lastReadId =
      echo && chat.lastReadId === echo.id ? localId : chat.lastReadId;

    return { ...chat, messages, lastReadId };
  });

/** The API refused the message, or the request never made it. */
export const failPendingMessage = (
  state: ChatsState,
  chatId: string,
  localId: string,
  errorKind: ApiErrorKind,
): Partial<ChatsState> =>
  updateChat(state, chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((message) =>
      message.id === localId
        ? { ...message, status: 'failed' as const, errorKind }
        : message,
    ),
  }));
