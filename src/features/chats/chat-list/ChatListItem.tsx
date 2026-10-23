import { formatChatTime } from '@/shared/lib/time';
import { ChatAvatar } from '../components/ChatAvatar';
import { DeliveryMark } from '../components/DeliveryMark';
import type { Chat, Message } from '../store/types';
import { unreadCount } from '../store/unread';

const previewOf = (message: Message) =>
  message.content.kind === 'text'
    ? message.content.text
    : 'Сообщение не поддерживается';

type ChatListItemProps = {
  chat: Chat;
  /** The chat that is open. */
  active: boolean;
  onSelect: (chatId: string) => void;
};

/** One row of the chat list: avatar, name, last message, time, unread count. */
export const ChatListItem = ({ chat, active, onSelect }: ChatListItemProps) => {
  const last = chat.messages.at(-1);
  const unread = unreadCount(chat);

  const rowClass = active
    ? 'bg-bg-selected'
    : 'bg-bg hover:bg-row-hover active:bg-row-pressed';

  const handleClick = () => onSelect(chat.chatId);

  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={handleClick}
      className={`flex h-20.5 w-full cursor-pointer gap-4 px-4 py-2.25 text-left ${rowClass}`}
    >
      <ChatAvatar
        chatId={chat.chatId}
        name={chat.name}
        className="size-14 self-center"
      />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] leading-5 font-medium tracking-[0.15px]">
            {chat.name ?? chat.chatId}
          </span>
          {last && (
            <span className="text-text-tertiary flex shrink-0 items-center gap-1 text-[13px] leading-4">
              {last.direction === 'outgoing' && last.status && (
                <DeliveryMark status={last.status} className="text-accent" />
              )}
              {formatChatTime(last.timestamp)}
            </span>
          )}
        </span>

        <span className="flex items-start gap-2">
          <span className="text-text-tertiary line-clamp-2 min-w-0 flex-1 pt-0.5 text-[15px] leading-5 tracking-[0.15px]">
            {last ? previewOf(last) : 'Нет сообщений'}
          </span>
          {unread > 0 && (
            <span
              role="img"
              aria-label={`Непрочитанных: ${unread}`}
              className="bg-badge mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs leading-4 font-semibold tracking-[0.3px] text-white"
            >
              {unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
};
