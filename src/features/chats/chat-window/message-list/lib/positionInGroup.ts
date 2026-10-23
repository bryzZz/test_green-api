import type { Message } from '../../../store/types';

export type BubblePosition = 'single' | 'first' | 'middle' | 'last';

/**
 * As in MAX, messages of one sender that follow each other on one day form a
 * group, however long the pauses between them were. Where a message stands in
 * its group decides which corners of its bubble are rounded.
 */
export const positionInGroup = (
  dayMessages: Message[],
  index: number,
): BubblePosition => {
  const { direction } = dayMessages[index];
  const joinsPrevious = dayMessages[index - 1]?.direction === direction;
  const joinsNext = dayMessages[index + 1]?.direction === direction;

  if (joinsPrevious && joinsNext) return 'middle';
  if (joinsNext) return 'first';
  if (joinsPrevious) return 'last';
  return 'single';
};
