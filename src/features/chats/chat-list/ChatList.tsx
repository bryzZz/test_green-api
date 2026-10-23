import type { Chat } from '../store/types';
import { ChatListItem } from './ChatListItem';

type ChatListProps = {
  /** Already sorted, newest activity first. */
  chats: Chat[];
  activeChatId?: string;
  onSelect: (chatId: string) => void;
};

export const ChatList = ({ chats, activeChatId, onSelect }: ChatListProps) => {
  if (chats.length === 0) {
    return (
      <p className="text-text-tertiary px-4 py-8 text-center text-[15px] leading-5">
        Нет чатов. Нажмите «+», чтобы начать новый.
      </p>
    );
  }

  return (
    <ul>
      {chats.map((chat) => (
        <li key={chat.chatId}>
          <ChatListItem
            chat={chat}
            active={chat.chatId === activeChatId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
};
