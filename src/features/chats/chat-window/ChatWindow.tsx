import { useState } from 'react';
import { useStore } from 'zustand';
import type { Credentials } from '@/api/createGreenApiClient';
import type { ChatsStore } from '../store/chatsStore';
import { firstUnreadId } from '../store/unread';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { MessageList } from './message-list/MessageList';
import { useMarkChatRead } from './useMarkChatRead';
import { useSendMessage } from './useSendMessage';

type ChatWindowProps = {
  credentials: Credentials;
  store: ChatsStore;
  chatId: string;
  onBack: () => void;
};

export const ChatWindow = ({
  credentials,
  store,
  chatId,
  onBack,
}: ChatWindowProps) => {
  const chat = useStore(store, (state) => state.chats[chatId]);
  const sendMessage = useSendMessage({ credentials, store, chatId });
  useMarkChatRead(store, chatId, chat?.messages.length);

  // Remembered once, when the chat is opened: the bar marks what was new then,
  // and stays there while the chat is open, as in MAX.
  const [unreadFromId] = useState(() => {
    const opened = store.getState().chats[chatId];
    return opened ? firstUnreadId(opened) : undefined;
  });

  if (!chat) return null;

  const handleSend = (text: string) => sendMessage.mutate(text);

  return (
    <>
      <ChatHeader chat={chat} onBack={onBack} />
      <MessageList messages={chat.messages} unreadFromId={unreadFromId} />
      <Composer onSend={handleSend} />
    </>
  );
};
