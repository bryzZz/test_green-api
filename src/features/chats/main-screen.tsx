import { LogOut, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { Credentials } from '../../api/client';
import { formatPhone } from '../../shared/lib/phone';
import { ghostButtonClass } from '../../shared/ui/ghost-button';
import { useMessageReceiver } from '../messages/use-message-receiver';
import { ChatList } from './chat-list';
import { ChatWindow } from './chat-window';
import { createChatsStore, selectSortedChats } from './chats-store';
import { NewChatDialog } from './new-chat-dialog';

type MainScreenProps = {
  credentials: Credentials;
  onLogout: () => void;
  /** GREEN-API rejected the credentials while receiving messages. */
  onSessionExpired: () => void;
};

export function MainScreen({
  credentials,
  onLogout,
  onSessionExpired,
}: MainScreenProps) {
  const [store] = useState(() => createChatsStore(credentials.idInstance));
  const chats = useStore(store, selectSortedChats);
  const chatIdByPhone = useStore(store, (state) => state.chatIdByPhone);
  const connected = useMessageReceiver({
    credentials,
    store,
    onUnauthorized: onSessionExpired,
  });

  const [activeChatId, setActiveChatId] = useState<string>();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const newChatButtonRef = useRef<HTMLButtonElement>(null);
  const activeChat = chats.find((chat) => chat.chatId === activeChatId);

  // An open chat is one step in the browser history, so on a phone the system
  // Back button returns to the list instead of leaving the site. Going from
  // one chat to another (side by side from md) stays one step.
  useEffect(() => {
    // A reload keeps the state of the entry it happened on: start from the list.
    window.history.replaceState(null, '');
    const onPopState = (event: PopStateEvent) =>
      setActiveChatId(event.state?.chatId);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function showChat(chatId: string) {
    if (activeChatId === undefined) {
      window.history.pushState({ chatId }, '');
    } else {
      window.history.replaceState({ chatId }, '');
    }
    setActiveChatId(chatId);
  }

  function closeChat() {
    if (window.history.state?.chatId) window.history.back();
    else setActiveChatId(undefined);
  }

  return (
    <div className="bg-bg flex h-full">
      {/* Phone: the list or the chat, one at a time. From md: side by side. */}
      <aside
        className={`${activeChat ? 'hidden' : 'flex'} w-full flex-col md:flex md:w-98.5 md:shrink-0`}
      >
        <header className="flex items-center justify-between px-4 pt-5 pb-3">
          {/* Like MAX: without a connection the title fades and says why. */}
          <div className="flex h-11 flex-col justify-center">
            <h1
              className={`text-2xl leading-7 font-semibold ${
                connected ? '' : 'text-text-secondary'
              }`}
            >
              Чаты
            </h1>
            {!connected && (
              <p
                role="status"
                className="text-text-tertiary text-[11px] leading-4"
              >
                Ожидание сети…
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Выйти"
              onClick={onLogout}
              className={`${ghostButtonClass} size-8`}
            >
              <LogOut className="size-5" />
            </button>
            <button
              ref={newChatButtonRef}
              type="button"
              aria-label="Новый чат"
              onClick={() => setNewChatOpen(true)}
              className="bg-accent hover:bg-accent-hover active:bg-accent-pressed flex size-8 cursor-pointer items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </header>

        <div className="scrollbar-overlay flex-1 overflow-y-auto">
          <ChatList
            chats={chats}
            activeChatId={activeChatId}
            onSelect={showChat}
          />
        </div>
      </aside>

      <section
        className={`${activeChat ? 'flex' : 'hidden'} bg-wallpaper min-w-0 flex-1 flex-col md:flex`}
      >
        {activeChat && (
          <ChatWindow
            key={activeChat.chatId}
            credentials={credentials}
            store={store}
            chatId={activeChat.chatId}
            onBack={closeChat}
          />
        )}
      </section>

      {newChatOpen && (
        <NewChatDialog
          credentials={credentials}
          knownChatId={(phone) => chatIdByPhone[phone]}
          onClose={() => {
            setNewChatOpen(false);
            // Cancelled: back to where the user was. Not done after a lookup
            // that opened a chat, there the focus belongs to that chat.
            newChatButtonRef.current?.focus();
          }}
          onResolved={({ phone, chatId }) => {
            const state = store.getState();
            state.rememberAccount(phone, chatId);
            state.openChat({ chatId, name: formatPhone(phone) });
            showChat(chatId);
            setNewChatOpen(false);
          }}
        />
      )}
    </div>
  );
}
