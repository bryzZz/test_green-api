import { persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import type { ApiErrorKind } from '../../api/errors';
import type {
  MessageContent,
  NotificationEvent,
} from '../../api/notifications';

export type MessageStatus =
  'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type Message = {
  /** Local key; stays stable while the message goes pending → sent. */
  id: string;
  idMessage?: string;
  direction: 'incoming' | 'outgoing';
  content: MessageContent;
  /** Unix seconds. */
  timestamp: number;
  /** Outgoing messages only. */
  status?: MessageStatus;
  errorKind?: ApiErrorKind;
};

export type Chat = {
  chatId: string;
  name?: string;
  /** Unix seconds; keeps a chat without messages in the right place. */
  createdAt: number;
  messages: Message[];
  /** The last message the user has seen; incoming ones after it are unread. */
  lastReadId?: string;
};

/** Incoming messages the user has not seen yet. */
function unreadMessages(chat: Chat): Message[] {
  const readUpTo = chat.lastReadId
    ? chat.messages.findIndex((m) => m.id === chat.lastReadId)
    : -1;
  // A read marker that is gone (not expected) must not flood the list with
  // badges: count that as everything read.
  if (chat.lastReadId && readUpTo === -1) return [];
  return chat.messages
    .slice(readUpTo + 1)
    .filter((m) => m.direction === 'incoming');
}

export const unreadCount = (chat: Chat) => unreadMessages(chat).length;

export const firstUnreadId = (chat: Chat) => unreadMessages(chat)[0]?.id;

type ChatsState = {
  chats: Record<string, Chat>;
  /** Phone number (digits) → chat id, so CheckAccount runs once per number. */
  chatIdByPhone: Record<string, string>;
  applyEvent: (event: NotificationEvent) => void;
  /** Creates the chat if it is new; an existing chat is left untouched. */
  openChat: (chat: { chatId: string; name?: string }) => void;
  rememberAccount: (phone: string, chatId: string) => void;
  /** The user has seen everything in the chat so far. */
  markRead: (chatId: string) => void;
  /** Adds a pending outgoing message and returns its local id. */
  startSending: (chatId: string, text: string) => string;
  confirmSent: (chatId: string, localId: string, idMessage: string) => void;
  failSent: (chatId: string, localId: string, errorKind: ApiErrorKind) => void;
};

// A status only ever moves forward; `failed` can interrupt it at any point.
const statusRank: Record<MessageStatus, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
};

const statusFromEvent = {
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
} as const;

function applyStatus(
  state: ChatsState,
  event: Extract<NotificationEvent, { type: 'status' }>,
): Partial<ChatsState> {
  const chat = state.chats[event.chatId];
  const index = chat?.messages.findIndex(
    (m) => m.idMessage === event.idMessage,
  );
  if (!chat || index === undefined || index === -1) return state;

  const message = chat.messages[index];
  const next = statusFromEvent[event.status];
  const current = message.status ?? 'sent';
  if (next !== 'failed' && statusRank[next] <= statusRank[current])
    return state;
  if (next === 'failed' && current === 'read') return state;

  const messages = chat.messages.map((m, i) =>
    i === index ? { ...m, status: next } : m,
  );
  return {
    chats: { ...state.chats, [event.chatId]: { ...chat, messages } },
  };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

const lastActivity = (chat: Chat) =>
  chat.messages.reduce(
    (latest, m) => Math.max(latest, m.timestamp),
    chat.createdAt,
  );

// Cached per `chats` object (replaced on every change), so the selector can be
// passed straight to a React hook without producing a new array on each render.
const sortedByChats = new WeakMap<Record<string, Chat>, Chat[]>();

export function selectSortedChats(state: ChatsState): Chat[] {
  let sorted = sortedByChats.get(state.chats);
  if (!sorted) {
    sorted = Object.values(state.chats).sort(
      (a, b) => lastActivity(b) - lastActivity(a),
    );
    sortedByChats.set(state.chats, sorted);
  }
  return sorted;
}

const byTime = (a: Message, b: Message) => a.timestamp - b.timestamp;

// A status moves forward only; a pending or failed message can always advance.
function forward(
  current: MessageStatus | undefined,
  next: MessageStatus,
): MessageStatus {
  if (!current || current === 'pending' || current === 'failed') return next;
  return statusRank[next] > statusRank[current] ? next : current;
}

type PersistedState = Pick<ChatsState, 'chats' | 'chatIdByPhone'>;

// A send that was still in flight when the page closed will never resolve.
function failPendingMessages(
  chats: Record<string, Chat>,
): Record<string, Chat> {
  return Object.fromEntries(
    Object.entries(chats).map(([chatId, chat]) => [
      chatId,
      {
        ...chat,
        messages: chat.messages.map((m) =>
          m.status === 'pending'
            ? { ...m, status: 'failed' as const, errorKind: 'network' as const }
            : m,
        ),
      },
    ]),
  );
}

export function createChatsStore(idInstance: string) {
  return createStore<ChatsState>()(
    persist(
      (set) => ({
        chats: {},
        chatIdByPhone: {},

        openChat: ({ chatId, name }) =>
          set((state) => {
            const existing = state.chats[chatId];
            if (!existing) {
              return {
                chats: {
                  ...state.chats,
                  [chatId]: {
                    chatId,
                    name,
                    createdAt: nowSeconds(),
                    messages: [],
                  },
                },
              };
            }
            // A chat born from a message may not have a name yet.
            if (existing.name || !name) return state;
            return {
              chats: { ...state.chats, [chatId]: { ...existing, name } },
            };
          }),

        rememberAccount: (phone, chatId) =>
          set((state) => ({
            chatIdByPhone: { ...state.chatIdByPhone, [phone]: chatId },
          })),

        startSending: (chatId, text) => {
          const id = crypto.randomUUID();
          const message: Message = {
            id,
            direction: 'outgoing',
            content: { kind: 'text', text },
            timestamp: nowSeconds(),
            status: 'pending',
          };
          set((state) => {
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
          });
          return id;
        },

        markRead: (chatId) =>
          set((state) => {
            const chat = state.chats[chatId];
            const last = chat?.messages.at(-1);
            if (!chat || !last || chat.lastReadId === last.id) return state;
            return {
              chats: {
                ...state.chats,
                [chatId]: { ...chat, lastReadId: last.id },
              },
            };
          }),

        confirmSent: (chatId, localId, idMessage) =>
          set((state) => {
            const chat = state.chats[chatId];
            if (!chat) return state;
            // The API echo (or even its statuses) may have arrived before the
            // send response: keep the local entry, which the UI already renders,
            // and take over whatever the echo has learned.
            const echo = chat.messages.find(
              (m) => m.idMessage === idMessage && m.id !== localId,
            );
            const messages = chat.messages
              .filter((m) => m !== echo)
              .map((m) =>
                m.id === localId
                  ? {
                      ...m,
                      idMessage,
                      status: forward(m.status, echo?.status ?? 'sent'),
                    }
                  : m,
              );
            // The echo may have been the read marker: it moves to the entry
            // that took its place.
            const lastReadId =
              echo && chat.lastReadId === echo.id ? localId : chat.lastReadId;
            return {
              chats: {
                ...state.chats,
                [chatId]: { ...chat, messages, lastReadId },
              },
            };
          }),

        failSent: (chatId, localId, errorKind) =>
          set((state) => {
            const chat = state.chats[chatId];
            if (!chat) return state;
            const messages = chat.messages.map((m) =>
              m.id === localId
                ? { ...m, status: 'failed' as const, errorKind }
                : m,
            );
            return {
              chats: { ...state.chats, [chatId]: { ...chat, messages } },
            };
          }),

        applyEvent: (event) => {
          if (event.type === 'status') {
            set((state) => applyStatus(state, event));
            return;
          }
          if (event.type !== 'message') return;

          set((state) => {
            const chat = state.chats[event.chatId] ?? {
              chatId: event.chatId,
              name: event.chatName,
              createdAt: event.timestamp,
              messages: [],
            };
            if (chat.messages.some((m) => m.idMessage === event.idMessage)) {
              return state;
            }
            const name = chat.name ?? event.chatName;

            // The echo of a message we sent from here: it may have been shown
            // as pending or failed (e.g. the request timed out although the
            // server accepted it), so adopt it instead of adding a duplicate.
            const text =
              event.direction === 'outgoing' && event.content.kind === 'text'
                ? event.content.text
                : undefined;
            const ownIndex =
              text === undefined
                ? -1
                : chat.messages.findIndex(
                    (m) =>
                      !m.idMessage &&
                      (m.status === 'pending' || m.status === 'failed') &&
                      m.content.kind === 'text' &&
                      m.content.text === text,
                  );
            const messages =
              ownIndex !== -1
                ? chat.messages.map((m, i) =>
                    i === ownIndex
                      ? {
                          ...m,
                          idMessage: event.idMessage,
                          status: 'sent' as const,
                          errorKind: undefined,
                        }
                      : m,
                  )
                : [
                    ...chat.messages,
                    {
                      id: event.idMessage,
                      idMessage: event.idMessage,
                      direction: event.direction,
                      content: event.content,
                      timestamp: event.timestamp,
                      ...(event.direction === 'outgoing' && {
                        status: 'sent' as const,
                      }),
                    } satisfies Message,
                  ].sort(byTime);

            return {
              chats: {
                ...state.chats,
                [event.chatId]: { ...chat, name, messages },
              },
            };
          });
        },
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
            chats: failPendingMessages(saved?.chats ?? {}),
            chatIdByPhone: saved?.chatIdByPhone ?? {},
          };
        },
      },
    ),
  );
}

export type ChatsStore = ReturnType<typeof createChatsStore>;
