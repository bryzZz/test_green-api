import type { ComponentProps } from 'react';

// The "ghost" icon buttons of MAX: transparent, a faint circle on hover
// (rgba(13,13,13,.04)) and a bit darker while pressed (.08). Size it with
// `size-*` through `className`.
const buttonClass =
  'text-icon hover:bg-ghost-hover active:bg-ghost-pressed flex cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const GhostButton = ({
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'>) => (
  <button type={type} className={`${buttonClass} ${className}`} {...props} />
);
