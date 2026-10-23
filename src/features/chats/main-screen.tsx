import { ArrowLeft, LogOut, Plus } from 'lucide-react';
import { useState } from 'react';
import { useStore } from 'zustand';
import type { Credentials } from '../../api/client';
import { formatPhone } from '../../shared/lib/phone';
import { ChatAvatar } from './chat-avatar';
import { ChatList } from './chat-list';
import { createChatsStore, selectSortedChats } from './chats-store';
import { NewChatDialog } from './new-chat-dialog';

type MainScreenProps = {
  credentials: Credentials;
  onLogout: () => void;
};

export function MainScreen({ credentials, onLogout }: MainScreenProps) {
  const [store] = useState(() => createChatsStore(credentials.idInstance));
  const chats = useStore(store, selectSortedChats);
  const chatIdByPhone = useStore(store, (state) => state.chatIdByPhone);

  const [activeChatId, setActiveChatId] = useState<string>();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const activeChat = chats.find((chat) => chat.chatId === activeChatId);

  return (
    <div className="bg-bg flex h-full">
      {/* Phone: the list or the chat, one at a time. From md: side by side. */}
      <aside
        className={`${activeChat ? 'hidden' : 'flex'} w-full flex-col md:flex md:w-98.5 md:shrink-0`}
      >
        <header className="flex items-center justify-between px-4 pt-5 pb-3">
          <h1 className="text-2xl leading-7 font-semibold">Чаты</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Выйти"
              onClick={onLogout}
              className="text-text-tertiary hover:text-text flex size-8 cursor-pointer items-center justify-center rounded-full"
            >
              <LogOut className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Новый чат"
              onClick={() => setNewChatOpen(true)}
              className="bg-accent hover:bg-accent-hover active:bg-accent-pressed flex size-8 cursor-pointer items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <ChatList
            chats={chats}
            activeChatId={activeChatId}
            onSelect={setActiveChatId}
          />
        </div>
      </aside>

      <section
        className={`${activeChat ? 'flex' : 'hidden'} bg-wallpaper min-w-0 flex-1 flex-col md:flex`}
      >
        {activeChat && (
          <header className="bg-bg flex h-16.25 shrink-0 items-center gap-2 px-4">
            <button
              type="button"
              aria-label="Назад к списку"
              onClick={() => setActiveChatId(undefined)}
              className="flex size-10 cursor-pointer items-center justify-center rounded-full"
            >
              <ArrowLeft className="size-6" />
            </button>
            <ChatAvatar
              chatId={activeChat.chatId}
              name={activeChat.name}
              className="size-10 text-base"
            />
            <h2 className="truncate text-base leading-5 font-semibold tracking-[0.15px]">
              {activeChat.name ?? activeChat.chatId}
            </h2>
          </header>
        )}
      </section>

      {newChatOpen && (
        <NewChatDialog
          credentials={credentials}
          knownChatId={(phone) => chatIdByPhone[phone]}
          onClose={() => setNewChatOpen(false)}
          onResolved={({ phone, chatId }) => {
            const state = store.getState();
            state.rememberAccount(phone, chatId);
            state.openChat({ chatId, name: formatPhone(phone) });
            setActiveChatId(chatId);
            setNewChatOpen(false);
          }}
        />
      )}
    </div>
  );
}
