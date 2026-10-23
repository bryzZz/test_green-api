import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ApiErrorKind } from '../../api/errors';
import { dayKey, formatChatTime, formatDayLabel } from '../../shared/lib/time';
import type { Message } from './chats-store';
import { DeliveryMark } from './delivery-mark';

// Within this distance from the bottom, a new message keeps the list pinned.
const STICK_TO_BOTTOM_PX = 120;

const failureReasons: Record<ApiErrorKind, string> = {
  quota: 'Не отправлено: достигнут лимит тарифа на новые чаты.',
  network: 'Не отправлено: нет соединения с сервером.',
  unauthorized: 'Не отправлено: учётные данные больше не действуют.',
  rateLimited: 'Не отправлено: слишком много запросов, подождите немного.',
  badRequest: 'Не отправлено: что-то пошло не так.',
  server: 'Не отправлено: что-то пошло не так.',
};

function failureReason(message: Message) {
  return message.errorKind
    ? failureReasons[message.errorKind]
    : 'Не удалось отправить сообщение.';
}

function groupByDay(messages: Message[]) {
  const days: { key: string; messages: Message[] }[] = [];
  for (const message of messages) {
    const key = dayKey(message.timestamp);
    const day = days.at(-1);
    if (day?.key === key) day.messages.push(message);
    else days.push({ key, messages: [message] });
  }
  return days;
}

type MessageListProps = {
  messages: Message[];
};

export function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const knownCountRef = useRef(0);
  const hasMessages = messages.length > 0;

  // Stay at the bottom while the reader is there: a message arrives, a status
  // adds a line under a bubble, the list grows. Someone reading older messages
  // is left alone, except that sending a message brings them back down.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const added = messages.length > knownCountRef.current;
    knownCountRef.current = messages.length;
    if (added && messages.at(-1)?.direction === 'outgoing') {
      pinnedRef.current = true;
    }
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The same when the room changes without the messages changing: the composer
  // grows, the window is resized, the on-screen keyboard opens.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const follow = () => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight;
    };
    const observer = new ResizeObserver(follow);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [hasMessages]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto"
    >
      {messages.length === 0 ? (
        <p className="text-text-inverse mx-auto mt-6 w-fit rounded-sm bg-capsule px-3 py-1 text-sm leading-[18px] backdrop-blur-[25px]">
          Сообщений пока нет. Напишите первым.
        </p>
      ) : (
        <ol className="mx-auto flex max-w-183 flex-col px-4 pb-2">
          {groupByDay(messages).map((day) => (
            <li key={day.key} className="flex flex-col">
              {/* Sticks to the top while its day is being read, like in MAX. */}
              <span
                data-testid="day-label"
                className="text-text-inverse bg-capsule sticky top-2 z-10 mt-2 self-center rounded-sm px-1.5 py-px text-sm leading-[18px] tracking-[0.15px] backdrop-blur-[25px]"
              >
                {formatDayLabel(day.messages[0].timestamp)}
              </span>
              {day.messages.map((message, index) => (
                <Bubble
                  key={message.id}
                  message={message}
                  position={positionInGroup(day.messages, index)}
                />
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type Position = 'single' | 'first' | 'middle' | 'last';

// As in MAX, messages of one sender that follow each other on one day form a
// group, however long the pauses between them were.
function positionInGroup(dayMessages: Message[], index: number): Position {
  const { direction } = dayMessages[index];
  const joinsPrevious = dayMessages[index - 1]?.direction === direction;
  const joinsNext = dayMessages[index + 1]?.direction === direction;

  if (joinsPrevious && joinsNext) return 'middle';
  if (joinsNext) return 'first';
  if (joinsPrevious) return 'last';
  return 'single';
}

// A bubble has 16px corners; the side the tail points to is 6px where the
// bubble touches its neighbour in the group.
const cornersOfIncoming: Record<Position, string> = {
  single: '',
  first: 'rounded-bl-xs',
  middle: 'rounded-l-xs',
  last: 'rounded-tl-xs',
};
const cornersOfOutgoing: Record<Position, string> = {
  single: '',
  first: 'rounded-br-xs',
  middle: 'rounded-r-xs',
  last: 'rounded-tr-xs',
};

function Bubble({
  message,
  position,
}: {
  message: Message;
  position: Position;
}) {
  const outgoing = message.direction === 'outgoing';
  const corners = (outgoing ? cornersOfOutgoing : cornersOfIncoming)[position];
  const startsGroup = position === 'single' || position === 'first';

  return (
    <div
      data-direction={message.direction}
      data-position={position}
      className={`flex flex-col ${startsGroup ? 'mt-2' : 'mt-0.5'} ${
        outgoing ? 'items-end' : 'items-start'
      }`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-2.5 pt-2 pb-2.5 text-base leading-5 wrap-break-word md:max-w-[70%] ${corners} ${
          outgoing
            ? 'bg-bubble-out text-bubble-out-text'
            : 'bg-bubble-in text-text'
        }`}
      >
        <span className="whitespace-pre-wrap">
          {message.content.kind === 'text'
            ? message.content.text
            : 'Сообщение не поддерживается'}
        </span>
        {/* Floats to the bottom right, so short messages keep one line. */}
        <span
          className={`float-right mt-1.5 ml-2 flex items-center gap-0.5 text-[11px] leading-3.5 tracking-[0.3px] ${
            outgoing ? 'text-bubble-meta-out' : 'text-bubble-meta-in'
          }`}
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
}
