import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState, type ComponentProps } from 'react';
import { IMaskInput } from 'react-imask';
import { createGreenApiClient, type Credentials } from '../../api/client';
import { ApiError } from '../../api/errors';
import { normalizePhone } from '../../shared/lib/phone';
import { primaryButtonClass, Spinner } from '../../shared/ui/primary-button';

const COMPLETE_MASK = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

class NotRegisteredError extends Error {}

function describeError(error: unknown): string {
  if (error instanceof NotRegisteredError) {
    return 'Номер не зарегистрирован в MAX.';
  }
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return 'Нет соединения с сервером. Попробуйте ещё раз.';
      case 'rateLimited':
        return 'Слишком много запросов. Подождите немного и повторите.';
      case 'unauthorized':
        return 'Учётные данные больше не действуют. Войдите заново.';
    }
  }
  return 'Не удалось найти номер. Попробуйте ещё раз.';
}

type NewChatDialogProps = {
  credentials: Credentials;
  /** Chat id remembered for a phone number, so it need not be looked up again. */
  knownChatId: (phone: string) => string | undefined;
  onResolved: (result: { phone: string; chatId: string }) => void;
  onClose: () => void;
};

export function NewChatDialog({
  credentials,
  knownChatId,
  onResolved,
  onClose,
}: NewChatDialogProps) {
  const [value, setValue] = useState('');
  // The mask shows the country code itself, so only a fully typed mask counts.
  const phone = COMPLETE_MASK.test(value) ? normalizePhone(value) : null;

  const lookup = useMutation({
    mutationFn: async (digits: string) => {
      const cached = knownChatId(digits);
      if (cached) return { phone: digits, chatId: cached };

      const result = await createGreenApiClient(credentials).checkAccount(
        Number(digits),
      );
      if (!result.exist || !result.chatId) throw new NotRegisteredError();
      return { phone: digits, chatId: result.chatId };
    },
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit: ComponentProps<'form'>['onSubmit'] = (event) => {
    event.preventDefault();
    // Passed here rather than to useMutation: these callbacks are dropped when
    // the dialog was closed meanwhile, so a cancelled lookup opens nothing.
    if (phone) lookup.mutate(phone, { onSuccess: (r) => onResolved(r) });
  };

  return (
    <div
      className="bg-overlay fixed inset-0 z-10 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        onSubmit={handleSubmit}
        className="bg-bg relative w-full max-w-105 rounded-4xl p-6"
      >
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="text-text-tertiary hover:text-text absolute top-4 right-4 cursor-pointer rounded-full p-1"
        >
          <X className="size-5" />
        </button>

        <h2
          id="new-chat-title"
          className="mb-5 text-2xl leading-7 font-semibold"
        >
          Новый чат
        </h2>

        <fieldset disabled={lookup.isPending}>
          <label className="block">
            <span className="sr-only">Номер телефона</span>
            <IMaskInput
              mask="+{7} (000) 000-00-00"
              value={value}
              // A leading 8 (or a pasted +7 / 7) is the country code, which
              // the mask already shows.
              prepare={(appended, masked) =>
                ['', '7'].includes(masked.unmaskedValue)
                  ? appended.replace(/^(\+7|\+|7|8)/, '')
                  : appended
              }
              onAccept={(accepted: string) => {
                setValue(accepted);
                lookup.reset();
              }}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              autoFocus
              placeholder="+7 (999) 123-45-67"
              className="rounded-lg bg-input caret-accent placeholder:text-text-tertiary h-13 w-full px-3 text-base leading-5 outline-none"
            />
          </label>

          {lookup.isError && (
            <p
              role="alert"
              className="text-text-negative mt-2 text-[13px] leading-4"
            >
              {describeError(lookup.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={!phone}
            aria-busy={lookup.isPending}
            className={primaryButtonClass}
          >
            {lookup.isPending ? (
              <>
                <Spinner />
                Ищем…
              </>
            ) : (
              'Открыть чат'
            )}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
