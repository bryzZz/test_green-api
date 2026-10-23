// States as measured on web.max.ru: lighter on hover, darker while pressed,
// washed out (and not clickable) while disabled.
export const primaryButtonClass =
  'rounded-xl bg-accent enabled:hover:bg-accent-hover enabled:active:bg-accent-pressed mt-2 flex h-15 w-full cursor-pointer items-center justify-center gap-2 px-5.5 text-[17px] leading-5 font-medium text-white disabled:cursor-default disabled:bg-accent-disabled disabled:text-white/72 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Spinner() {
  return (
    <span
      aria-hidden
      data-testid="spinner"
      className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}
