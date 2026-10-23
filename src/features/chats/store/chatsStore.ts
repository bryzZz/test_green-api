import { persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { nowSeconds } from '@/shared/lib/time';
import { applyMessageEvent } from './applyMessageEvent';
import { failInterruptedSends } from './failInterruptedSends';
import { applyStatus } from './messageStatus';
import {
  appendPendingMessage,
  confirmPendingMessage,
  failPendingMessage,
} from './sending';
import type { ChatsState, Message } from './types';
import { updateChat } from './updateChat';

type PersistedState = Pick<ChatsState, 'chats' | 'chatIdByPhone'>;

/**
 * The chats of one GREEN-API instance and what was said in them, kept in
 * localStorage under the instance id. The state changes themselves live in
 * the neighbouring modules; this only wires them to the actions.
 */
export const createChatsStore = (idInstance: string) =>
  createStore<ChatsState>()(
    persist(
      (set) => ({
        chats: {},
        chatIdByPhone: {},

        applyEvent: (event) => {
          if (event.type === 'status') {
            set((state) => applyStatus(state, event));
          }
          if (event.type === 'message') {
            set((state) => applyMessageEvent(state, event));
          }
        },

        openChat: ({ chatId, name }) =>
          set((state) => {
            if (!state.chats[chatId]) {
              const chat = {
                chatId,
                name,
                createdAt: nowSeconds(),
                messages: [],
              };
              return { chats: { ...state.chats, [chatId]: chat } };
            }
            // A chat born from a message may not have a name yet.
            return updateChat(state, chatId, (chat) =>
              chat.name || !name ? chat : { ...chat, name },
            );
          }),

        rememberAccount: (phone, chatId) =>
          set((state) => ({
            chatIdByPhone: { ...state.chatIdByPhone, [phone]: chatId },
          })),

        markRead: (chatId) =>
          set((state) =>
            updateChat(state, chatId, (chat) => {
              const last = chat.messages.at(-1);
              if (!last || chat.lastReadId === last.id) return chat;
              return { ...chat, lastReadId: last.id };
            }),
          ),

        startSending: (chatId, text) => {
          const message: Message = {
            id: crypto.randomUUID(),
            direction: 'outgoing',
            content: { kind: 'text', text },
            timestamp: nowSeconds(),
            status: 'pending',
          };
          set((state) => appendPendingMessage(state, chatId, message));
          return message.id;
        },

        confirmSent: (chatId, localId, idMessage) =>
          set((state) =>
            confirmPendingMessage(state, chatId, localId, idMessage),
          ),

        failSent: (chatId, localId, errorKind) =>
          set((state) => failPendingMessage(state, chatId, localId, errorKind)),
      }),
      {
        name: `max-chat:chats:${idInstance}`,
        partialize: ({ chats, chatIdByPhone }): PersistedState => ({
          chats,
          chatIdByPhone,
        }),
        merge: (persisted, current) => {
          const saved = persisted as Partial<PersistedState> | undefined;
          return {
            ...current,
            chats: failInterruptedSends(saved?.chats ?? {}),
            chatIdByPhone: saved?.chatIdByPhone ?? {},
          };
        },
      },
    ),
  );

export type ChatsStore = ReturnType<typeof createChatsStore>;
