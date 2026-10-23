import type { ComponentProps } from 'react';

// States as measured on web.max.ru: lighter on hover, darker while pressed,
// washed out (and not clickable) while disabled.
const buttonClass =
  'rounded-xl bg-accent enabled:hover:bg-accent-hover enabled:active:bg-accent-pressed mt-2 flex h-15 w-full cursor-pointer items-center justify-center gap-2 px-5.5 text-[17px] leading-5 font-medium text-white disabled:cursor-default disabled:bg-accent-disabled disabled:text-white/72 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const PrimaryButton = ({
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'>) => (
  <button type={type} className={`${buttonClass} ${className}`} {...props} />
);
