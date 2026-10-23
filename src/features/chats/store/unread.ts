import type { Chat, Message } from './types';

/** Incoming messages the user has not seen yet. */
const unreadMessages = (chat: Chat): Message[] => {
  const readUpTo = chat.lastReadId
    ? chat.messages.findIndex((message) => message.id === chat.lastReadId)
    : -1;

  // A read marker that is gone (not expected) must not flood the list with
  // badges: count that as everything read.
  if (chat.lastReadId && readUpTo === -1) return [];

  return chat.messages
    .slice(readUpTo + 1)
    .filter((message) => message.direction === 'incoming');
};

export const unreadCount = (chat: Chat) => unreadMessages(chat).length;

export const firstUnreadId = (chat: Chat) => unreadMessages(chat)[0]?.id;
