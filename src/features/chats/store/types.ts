import type { ApiErrorKind } from '@/api/ApiError';
import type {
  MessageContent,
  NotificationEvent,
} from '@/api/parseNotification';

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

export type ChatsState = {
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
