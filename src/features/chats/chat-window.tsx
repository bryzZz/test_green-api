import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { createGreenApiClient, type Credentials } from '../../api/client';
import { ApiError } from '../../api/errors';
import { ghostButtonClass } from '../../shared/ui/ghost-button';
import { ChatAvatar } from './chat-avatar';
import { firstUnreadId, type ChatsStore } from './chats-store';
import { Composer } from './composer';
import { MessageList } from './message-list';

type ChatWindowProps = {
  credentials: Credentials;
  store: ChatsStore;
  chatId: string;
  onBack: () => void;
};

export function ChatWindow({
  credentials,
  store,
  chatId,
  onBack,
}: ChatWindowProps) {
  const chat = useStore(store, (state) => state.chats[chatId]);

  // Remembered once, when the chat is opened: the bar marks what was new then,
  // and stays there while the chat is open, as in MAX.
  const [unreadFromId] = useState(() => {
    const opened = store.getState().chats[chatId];
    return opened ? firstUnreadId(opened) : undefined;
  });

  // Whatever is on screen, now or when it arrives, has been seen: but only
  // while the user is looking. Messages that come in a hidden tab stay unread
  // until they are back.
  const messageCount = chat?.messages.length;
  useEffect(() => {
    const markReadIfVisible = () => {
      if (document.visibilityState === 'visible') {
        store.getState().markRead(chatId);
      }
    };
    markReadIfVisible();
    document.addEventListener('visibilitychange', markReadIfVisible);
    return () =>
      document.removeEventListener('visibilitychange', markReadIfVisible);
  }, [store, chatId, messageCount]);
  const client = useMemo(
    () => createGreenApiClient(credentials),
    [credentials],
  );

  // The callbacks are options of the mutation itself, so a message still
  // leaves "pending" when the user moves to another chat meanwhile.
  const send = useMutation({
    onMutate: (text: string) => store.getState().startSending(chatId, text),
    mutationFn: (text: string) => client.sendMessage({ chatId, message: text }),
    onSuccess: ({ idMessage }, _text, localId) => {
      if (localId) store.getState().confirmSent(chatId, localId, idMessage);
    },
    onError: (error, _text, localId) => {
      if (!localId) return;
      const kind = error instanceof ApiError ? error.kind : 'server';
      store.getState().failSent(chatId, localId, kind);
    },
  });

  if (!chat) return null;

  return (
    <>
      <header className="bg-bg flex h-16.25 shrink-0 items-center gap-2 px-4">
        <button
          type="button"
          aria-label="Назад к списку"
          onClick={onBack}
          className={`${ghostButtonClass} size-10`}
        >
          <ArrowLeft className="size-6" />
        </button>
        <ChatAvatar
          chatId={chat.chatId}
          name={chat.name}
          className="size-10 text-base"
        />
        <h2 className="truncate text-base leading-5 font-semibold tracking-[0.15px]">
          {chat.name ?? chat.chatId}
        </h2>
      </header>

      <MessageList messages={chat.messages} unreadFromId={unreadFromId} />
      <Composer onSend={(text) => send.mutate(text)} />
    </>
  );
}
