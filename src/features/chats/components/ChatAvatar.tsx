import { User } from 'lucide-react';
import { avatarGradient, getInitials } from '../lib/avatar';

type ChatAvatarProps = {
  chatId: string;
  name?: string;
  className?: string;
};

/** The initials of the chat on a color picked from its id. */
export const ChatAvatar = ({
  chatId,
  name,
  className = 'size-14',
}: ChatAvatarProps) => {
  const { from, to } = avatarGradient(chatId);
  const initials = getInitials(name);

  return (
    <span
      aria-hidden
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
      className={`flex shrink-0 items-center justify-center rounded-full text-xl font-medium text-white ${className}`}
    >
      {initials || <User data-testid="avatar-fallback" className="size-1/2" />}
    </span>
  );
};
