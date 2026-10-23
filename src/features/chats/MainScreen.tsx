import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { Credentials } from '@/api/createGreenApiClient';
import { formatPhone } from '@/shared/lib/phone';
import { useMessageReceiver } from '../messages/useMessageReceiver';
import { ChatList } from './chat-list/ChatList';
import { ChatListHeader } from './chat-list/ChatListHeader';
import { ChatWindow } from './chat-window/ChatWindow';
import { useOpenChat } from './hooks/useOpenChat';
import { NewChatDialog } from './new-chat/NewChatDialog';
import { createChatsStore } from './store/chatsStore';
import { selectSortedChats } from './store/selectSortedChats';

type MainScreenProps = {
  credentials: Credentials;
  onLogout: () => void;
  /** GREEN-API rejected the credentials while receiving messages. */
  onSessionExpired: () => void;
};

export const MainScreen = ({
  credentials,
  onLogout,
  onSessionExpired,
}: MainScreenProps) => {
  const [store] = useState(() => createChatsStore(credentials.idInstance));
  const chats = useStore(store, selectSortedChats);
  const chatIdByPhone = useStore(store, (state) => state.chatIdByPhone);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const newChatButtonRef = useRef<HTMLButtonElement>(null);
  const { openChatId, showChat, closeChat } = useOpenChat();
  const connected = useMessageReceiver({
    credentials,
    store,
    onUnauthorized: onSessionExpired,
  });

  const openChat = chats.find((chat) => chat.chatId === openChatId);

  // Phone: the list or the chat, one at a time. From md: side by side.
  const listClass = openChat ? 'hidden' : 'flex';
  const chatClass = openChat ? 'flex' : 'hidden';

  const handleNewChatOpen = () => setNewChatOpen(true);

  // Cancelled: back to where the user was. Not done after a lookup that
  // opened a chat, there the focus belongs to that chat.
  const handleNewChatCancel = () => {
    setNewChatOpen(false);
    newChatButtonRef.current?.focus();
  };

  const handleChatFound = ({
    phone,
    chatId,
  }: {
    phone: string;
    chatId: string;
  }) => {
    store.getState().rememberAccount(phone, chatId);
    store.getState().openChat({ chatId, name: formatPhone(phone) });
    showChat(chatId);
    setNewChatOpen(false);
  };

  return (
    <div className="bg-bg flex h-full">
      <aside
        className={`${listClass} w-full flex-col md:flex md:w-98.5 md:shrink-0`}
      >
        <ChatListHeader
          connected={connected}
          onLogout={onLogout}
          onNewChat={handleNewChatOpen}
          newChatButtonRef={newChatButtonRef}
        />
        <div className="scrollbar-overlay flex-1 overflow-y-auto">
          <ChatList
            chats={chats}
            activeChatId={openChatId}
            onSelect={showChat}
          />
        </div>
      </aside>

      <section
        className={`${chatClass} bg-wallpaper min-w-0 flex-1 flex-col md:flex`}
      >
        {openChat && (
          <ChatWindow
            key={openChat.chatId}
            credentials={credentials}
            store={store}
            chatId={openChat.chatId}
            onBack={closeChat}
          />
        )}
      </section>

      {newChatOpen && (
        <NewChatDialog
          credentials={credentials}
          knownChatId={(phone) => chatIdByPhone[phone]}
          onClose={handleNewChatCancel}
          onResolved={handleChatFound}
        />
      )}
    </div>
  );
};
