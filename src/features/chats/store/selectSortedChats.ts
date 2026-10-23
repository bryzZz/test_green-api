import type { Chat, ChatsState } from './types';

const lastActivity = (chat: Chat) =>
  chat.messages.reduce(
    (latest, message) => Math.max(latest, message.timestamp),
    chat.createdAt,
  );

// Cached per `chats` object (replaced on every change), so the selector can be
// passed straight to a React hook without producing a new array on each render.
const sortedByChats = new WeakMap<Record<string, Chat>, Chat[]>();

/** The chats, the one with the latest activity first. */
export const selectSortedChats = (state: ChatsState): Chat[] => {
  const cached = sortedByChats.get(state.chats);
  if (cached) return cached;

  const sorted = Object.values(state.chats).sort(
    (a, b) => lastActivity(b) - lastActivity(a),
  );
  sortedByChats.set(state.chats, sorted);
  return sorted;
};
