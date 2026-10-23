import type { Chat, ChatsState } from './types';

/**
 * A state change that edits one chat. Nothing changes (and nobody re-renders)
 * when the chat does not exist or `update` returns the very same chat.
 */
export const updateChat = (
  state: ChatsState,
  chatId: string,
  update: (chat: Chat) => Chat,
): Partial<ChatsState> => {
  const chat = state.chats[chatId];
  if (!chat) return state;

  const updated = update(chat);
  if (updated === chat) return state;
  return { chats: { ...state.chats, [chatId]: updated } };
};
