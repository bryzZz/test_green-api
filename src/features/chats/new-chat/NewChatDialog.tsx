import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRef, useState, type FormEvent, type MouseEvent } from 'react';
import type { Credentials } from '@/api/createGreenApiClient';
import { normalizePhone } from '@/shared/lib/phone';
import { GhostButton } from '@/shared/ui/GhostButton';
import { PrimaryButton } from '@/shared/ui/PrimaryButton';
import { Spinner } from '@/shared/ui/Spinner';
import { describeLookupError } from './lib/describeLookupError';
import { findChat } from './lib/findChat';
import { PhoneField } from './PhoneField';
import { useDialogKeyboard } from './useDialogKeyboard';

// The mask shows the country code itself, so only a fully typed mask counts.
const COMPLETE_MASK = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

type NewChatDialogProps = {
  credentials: Credentials;
  /** Chat id remembered for a phone number, so it need not be looked up again. */
  knownChatId: (phone: string) => string | undefined;
  onResolved: (result: { phone: string; chatId: string }) => void;
  onClose: () => void;
};

export const NewChatDialog = ({
  credentials,
  knownChatId,
  onResolved,
  onClose,
}: NewChatDialogProps) => {
  const [value, setValue] = useState('');
  const dialogRef = useRef<HTMLFormElement>(null);
  const lookup = useMutation({
    mutationFn: (phone: string) => findChat(credentials, knownChatId, phone),
  });
  useDialogKeyboard(dialogRef, onClose);

  const phone = COMPLETE_MASK.test(value) ? normalizePhone(value) : null;

  const handlePhoneChange = (masked: string) => {
    setValue(masked);
    lookup.reset();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!phone) return;
    // Passed here rather than to useMutation: these callbacks are dropped when
    // the dialog was closed meanwhile, so a cancelled lookup opens nothing.
    lookup.mutate(phone, { onSuccess: (found) => onResolved(found) });
  };

  const handleOverlayMouseDown = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    onClose();
  };

  return (
    <div
      className="bg-overlay fixed inset-0 z-10 flex items-center justify-center p-4"
      onMouseDown={handleOverlayMouseDown}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        onSubmit={handleSubmit}
        className="bg-bg relative w-full max-w-105 rounded-4xl p-6"
      >
        <GhostButton
          aria-label="Закрыть"
          className="absolute top-4 right-4 size-8"
          onClick={onClose}
        >
          <X className="size-5" />
        </GhostButton>

        <h2
          id="new-chat-title"
          className="mb-5 text-2xl leading-7 font-semibold"
        >
          Новый чат
        </h2>

        <fieldset disabled={lookup.isPending}>
          <PhoneField value={value} onChange={handlePhoneChange} />

          {lookup.isError && (
            <p
              role="alert"
              className="text-text-negative mt-2 text-[13px] leading-4"
            >
              {describeLookupError(lookup.error)}
            </p>
          )}

          <PrimaryButton
            type="submit"
            disabled={!phone}
            aria-busy={lookup.isPending}
          >
            {lookup.isPending ? (
              <>
                <Spinner />
                Ищем…
              </>
            ) : (
              'Открыть чат'
            )}
          </PrimaryButton>
        </fieldset>
      </form>
    </div>
  );
};
