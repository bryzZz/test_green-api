import { LogOut, Plus } from 'lucide-react';
import type { Ref } from 'react';
import { GhostButton } from '@/shared/ui/GhostButton';

type ChatListHeaderProps = {
  /** Whether messages can be received; if not, the header says so. */
  connected: boolean;
  onLogout: () => void;
  onNewChat: () => void;
  /** To give the focus back to «+» when the dialog it opened is cancelled. */
  newChatButtonRef?: Ref<HTMLButtonElement>;
};

export const ChatListHeader = ({
  connected,
  onLogout,
  onNewChat,
  newChatButtonRef,
}: ChatListHeaderProps) => (
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
        <p role="status" className="text-text-tertiary text-[11px] leading-4">
          Ожидание сети…
        </p>
      )}
    </div>

    <div className="flex items-center gap-2">
      <GhostButton aria-label="Выйти" className="size-8" onClick={onLogout}>
        <LogOut className="size-5" />
      </GhostButton>
      <button
        ref={newChatButtonRef}
        type="button"
        aria-label="Новый чат"
        onClick={onNewChat}
        className="bg-accent hover:bg-accent-hover active:bg-accent-pressed flex size-8 cursor-pointer items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Plus className="size-5" />
      </button>
    </div>
  </header>
);
