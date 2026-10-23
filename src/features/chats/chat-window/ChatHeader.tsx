import { ArrowLeft } from 'lucide-react';
import { GhostButton } from '@/shared/ui/GhostButton';
import { ChatAvatar } from '../components/ChatAvatar';
import type { Chat } from '../store/types';

type ChatHeaderProps = {
  chat: Chat;
  onBack: () => void;
};

export const ChatHeader = ({ chat, onBack }: ChatHeaderProps) => (
  <header className="bg-bg flex h-16.25 shrink-0 items-center gap-2 px-4">
    <GhostButton
      aria-label="Назад к списку"
      className="size-10"
      onClick={onBack}
    >
      <ArrowLeft className="size-6" />
    </GhostButton>
    <ChatAvatar
      chatId={chat.chatId}
      name={chat.name}
      className="size-10 text-base"
    />
    <h2 className="truncate text-base leading-5 font-semibold tracking-[0.15px]">
      {chat.name ?? chat.chatId}
    </h2>
  </header>
);
