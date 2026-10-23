import { dayKey } from '@/shared/lib/time';
import type { Message } from '../../../store/types';

export type DayGroup = { key: string; messages: Message[] };

/** Splits the messages (in time order) into the days they were sent on. */
export const groupByDay = (messages: Message[]): DayGroup[] => {
  const days: DayGroup[] = [];

  for (const message of messages) {
    const key = dayKey(message.timestamp);
    const lastDay = days.at(-1);
    if (lastDay?.key === key) {
      lastDay.messages.push(message);
      continue;
    }
    days.push({ key, messages: [message] });
  }

  return days;
};
