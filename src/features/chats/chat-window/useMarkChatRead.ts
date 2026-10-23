import { useEffect } from 'react';
import type { ChatsStore } from '../store/chatsStore';

/**
 * Whatever is on screen, now or when it arrives, has been seen: but only while
 * the user is looking. Messages that come in a hidden tab stay unread until
 * they are back.
 */
export const useMarkChatRead = (
  store: ChatsStore,
  chatId: string,
  messageCount: number | undefined,
) => {
  useEffect(() => {
    const markReadIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      store.getState().markRead(chatId);
    };

    markReadIfVisible();
    document.addEventListener('visibilitychange', markReadIfVisible);
    return () =>
      document.removeEventListener('visibilitychange', markReadIfVisible);
    // A new message changes `messageCount`, which runs this again.
  }, [store, chatId, messageCount]);
};
