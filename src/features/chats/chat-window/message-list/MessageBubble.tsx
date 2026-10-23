import { formatChatTime } from '@/shared/lib/time';
import { DeliveryMark } from '../../components/DeliveryMark';
import type { Message } from '../../store/types';
import { failureReason } from './lib/failureReason';
import type { BubblePosition } from './lib/positionInGroup';

// A bubble has 16px corners; where it touches its neighbour in the group, the
// corner on that side is 6px.
const CORNERS_OF_INCOMING: Record<BubblePosition, string> = {
  single: '',
  first: 'rounded-bl-xs',
  middle: 'rounded-l-xs',
  last: 'rounded-tl-xs',
};

const CORNERS_OF_OUTGOING: Record<BubblePosition, string> = {
  single: '',
  first: 'rounded-br-xs',
  middle: 'rounded-r-xs',
  last: 'rounded-tr-xs',
};

type MessageBubbleProps = {
  message: Message;
  position: BubblePosition;
};

export const MessageBubble = ({ message, position }: MessageBubbleProps) => {
  const outgoing = message.direction === 'outgoing';

  const corners = (outgoing ? CORNERS_OF_OUTGOING : CORNERS_OF_INCOMING)[
    position
  ];
  const startsGroup = position === 'single' || position === 'first';
  const rowClass = `${startsGroup ? 'mt-2' : 'mt-0.5'} ${
    outgoing ? 'items-end' : 'items-start'
  }`;
  const bubbleClass = outgoing
    ? 'bg-bubble-out text-bubble-out-text'
    : 'bg-bubble-in text-text';
  const metaClass = outgoing ? 'text-bubble-meta-out' : 'text-bubble-meta-in';

  return (
    <div
      data-direction={message.direction}
      data-position={position}
      className={`mx-auto flex w-full max-w-183 flex-col px-4 ${rowClass}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-2.5 pt-2 pb-2.5 text-base leading-5 wrap-break-word md:max-w-[70%] ${corners} ${bubbleClass}`}
      >
        <span className="whitespace-pre-wrap">
          {message.content.kind === 'text'
            ? message.content.text
            : 'Сообщение не поддерживается'}
        </span>
        {/* Floats to the bottom right, so short messages keep one line. */}
        <span
          className={`float-right mt-1.5 ml-2 flex items-center gap-0.5 text-[11px] leading-3.5 tracking-[0.3px] ${metaClass}`}
        >
          {formatChatTime(message.timestamp)}
          {outgoing && message.status && (
            <DeliveryMark status={message.status} className="text-status" />
          )}
        </span>
      </div>

      {message.status === 'failed' && (
        <p
          role="alert"
          className="text-text-negative mt-1 max-w-[85%] text-[13px] leading-4 md:max-w-[70%]"
        >
          {failureReason(message)}
        </p>
      )}
    </div>
  );
};
