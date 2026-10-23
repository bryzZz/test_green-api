import { useEffect, useEffectEvent, type RefObject } from 'react';

/**
 * Keyboard behaviour of a modal dialog: Escape closes it, and Tab goes round
 * inside it instead of reaching the page behind the overlay.
 *
 * It listens on the document, not on the dialog, so it also catches a Tab
 * pressed when the focused control has just been disabled, which leaves the
 * focus on the body.
 */
export const useDialogKeyboard = (
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) => {
  const handleClose = useEffectEvent(onClose);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
        return;
      }

      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;

      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled)',
        ),
      ];
      const active = document.activeElement as HTMLElement | null;
      // Not on one of the controls: outside the dialog, or on a control that
      // was disabled meanwhile.
      const lost = !active || !controls.includes(active);
      const edge = event.shiftKey ? controls[0] : controls.at(-1);
      if (!lost && active !== edge) return;

      event.preventDefault();
      const target = event.shiftKey ? controls.at(-1) : controls[0];
      target?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialogRef]);
};
