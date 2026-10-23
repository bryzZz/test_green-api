import { Fragment } from 'react';
import type { Message } from '../../store/types';
import { DayLabel } from './DayLabel';
import { groupByDay } from './lib/groupByDay';
import { positionInGroup } from './lib/positionInGroup';
import { MessageBubble } from './MessageBubble';
import { UnreadBar } from './UnreadBar';
import { useMessageListScroll } from './useMessageListScroll';

type MessageListProps = {
  messages: Message[];
  /** The first message the user has not seen: the bar goes above it. */
  unreadFromId?: string;
};

export const MessageList = ({ messages, unreadFromId }: MessageListProps) => {
  const { scrollRef, unreadBarRef, handleScroll } =
    useMessageListScroll(messages);

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
        <ol className="flex flex-col pb-2">
          {groupByDay(messages).map((day) => (
            <li key={day.key} className="flex flex-col">
              {/* Above the day label when the unread messages begin the day. */}
              {day.messages[0].id === unreadFromId && (
                <UnreadBar ref={unreadBarRef} />
              )}
              <DayLabel timestamp={day.messages[0].timestamp} />
              {day.messages.map((message, index) => (
                <Fragment key={message.id}>
                  {index > 0 && message.id === unreadFromId && (
                    <UnreadBar ref={unreadBarRef} />
                  )}
                  <MessageBubble
                    message={message}
                    position={positionInGroup(day.messages, index)}
                  />
                </Fragment>
              ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
