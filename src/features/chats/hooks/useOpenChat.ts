import { useEffect, useState } from 'react';

/**
 * Which chat is open. An open chat is one step in the browser history, so on
 * a phone the system Back button returns to the list instead of leaving the
 * site. Going from one chat to another (side by side from md) stays one step.
 */
export const useOpenChat = () => {
  const [openChatId, setOpenChatId] = useState<string>();

  useEffect(() => {
    // A reload keeps the state of the entry it happened on: start from the list.
    window.history.replaceState(null, '');

    const handlePopState = (event: PopStateEvent) =>
      setOpenChatId(event.state?.chatId);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const showChat = (chatId: string) => {
    if (openChatId === undefined) {
      window.history.pushState({ chatId }, '');
    } else {
      window.history.replaceState({ chatId }, '');
    }
    setOpenChatId(chatId);
  };

  const closeChat = () => {
    if (!window.history.state?.chatId) {
      setOpenChatId(undefined);
      return;
    }
    window.history.back();
  };

  return { openChatId, showChat, closeChat };
};
