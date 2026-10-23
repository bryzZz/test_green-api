import type { NotificationEvent } from '@/api/parseNotification';
import type { ChatsState, MessageStatus } from './types';
import { updateChat } from './updateChat';

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

/** Moves a status forward only; a pending or failed message can always advance. */
export const forwardStatus = (
  current: MessageStatus | undefined,
  next: MessageStatus,
): MessageStatus => {
  if (!current || current === 'pending' || current === 'failed') return next;
  return statusRank[next] > statusRank[current] ? next : current;
};

/** What GREEN-API reports about a sent message, applied to the stored one. */
export const applyStatus = (
  state: ChatsState,
  event: Extract<NotificationEvent, { type: 'status' }>,
): Partial<ChatsState> =>
  updateChat(state, event.chatId, (chat) => {
    const message = chat.messages.find((m) => m.idMessage === event.idMessage);
    if (!message) return chat;

    const next = statusFromEvent[event.status];
    const current = message.status ?? 'sent';
    // A late `delivered` must not undo `read`, and `read` cannot fail later.
    const isStale =
      next === 'failed'
        ? current === 'read'
        : statusRank[next] <= statusRank[current];
    if (isStale) return chat;

    return {
      ...chat,
      messages: chat.messages.map((m) =>
        m === message ? { ...m, status: next } : m,
      ),
    };
  });
