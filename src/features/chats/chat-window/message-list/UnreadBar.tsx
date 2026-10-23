import type { Ref } from 'react';

type UnreadBarProps = {
  ref?: Ref<HTMLDivElement>;
};

/** The bar MAX puts above the first message the user has not seen yet. */
export const UnreadBar = ({ ref }: UnreadBarProps) => (
  <div
    ref={ref}
    data-testid="unread-bar"
    className="text-text my-3 w-full bg-white/88 px-4 py-1 text-center text-sm leading-[18px] tracking-[0.15px]"
  >
    Новые сообщения
  </div>
);
