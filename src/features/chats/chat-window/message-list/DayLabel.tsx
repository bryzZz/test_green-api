import { formatDayLabel } from '@/shared/lib/time';

type DayLabelProps = {
  /** Unix seconds of any message of the day. */
  timestamp: number;
};

/** The capsule with the date; sticks to the top while its day is read, as in MAX. */
export const DayLabel = ({ timestamp }: DayLabelProps) => (
  <span
    data-testid="day-label"
    className="text-text-inverse bg-capsule sticky top-2 z-10 mt-2 self-center rounded-sm px-1.5 py-px text-sm leading-[18px] tracking-[0.15px] backdrop-blur-[25px]"
  >
    {formatDayLabel(timestamp)}
  </span>
);
