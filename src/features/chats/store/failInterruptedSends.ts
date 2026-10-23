import type { Chat } from './types';

/**
 * A send that was still in flight when the page closed will never resolve:
 * show it as failed instead of "sending" forever.
 */
export const failInterruptedSends = (
  chats: Record<string, Chat>,
): Record<string, Chat> =>
  Object.fromEntries(
    Object.entries(chats).map(([chatId, chat]) => [
      chatId,
      {
        ...chat,
        messages: chat.messages.map((message) =>
          message.status === 'pending'
            ? {
                ...message,
                status: 'failed' as const,
                errorKind: 'network' as const,
              }
            : message,
        ),
      },
    ]),
  );
