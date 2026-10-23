import { useMutation } from '@tanstack/react-query';
import { useState, type ComponentProps } from 'react';
import {
  createGreenApiClient,
  type Credentials,
  type Settings,
} from '../../api/client';
import { ApiError } from '../../api/errors';
import { primaryButtonClass, Spinner } from '../../shared/ui/primary-button';

const DEFAULT_API_URL = 'https://api.green-api.com';

class NotAuthorizedError extends Error {}

// The HTTP API reads notifications from a queue, which works only without a
// webhook URL and with these notification types enabled.
const REQUIRED_FLAGS = [
  'incomingWebhook',
  'outgoingWebhook',
  'outgoingMessageWebhook',
  'outgoingAPIMessageWebhook',
] as const;

function findProblems(settings: Settings): string[] {
  const problems: string[] = [];
  if (settings.webhookUrl !== '') problems.push('webhookUrl');
  for (const flag of REQUIRED_FLAGS) {
    if (settings[flag] !== 'yes') problems.push(flag);
  }
  return problems;
}

function describeLoginError(error: unknown): string {
  if (error instanceof NotAuthorizedError) {
    return 'Инстанс не авторизован. Отсканируйте QR-код в личном кабинете GREEN-API и повторите.';
  }
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'unauthorized':
        return 'Неверный idInstance или apiTokenInstance.';
      case 'network':
        return 'Нет соединения с сервером. Проверьте интернет и адрес API.';
      case 'rateLimited':
        return 'Слишком много запросов. Подождите немного и повторите.';
    }
  }
  return 'Не удалось войти. Попробуйте ещё раз.';
}

type LoginScreenProps = {
  onLoggedIn: (credentials: Credentials) => void;
};

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');

  const login = useMutation({
    mutationFn: async (credentials: Credentials) => {
      const client = createGreenApiClient(credentials);
      const { stateInstance } = await client.getStateInstance();
      if (stateInstance !== 'authorized') throw new NotAuthorizedError();

      // The settings are only used for a hint, so a failure here (e.g. the
      // 1 rps limit) must not stop the user from logging in.
      const settings = await client.getSettings().catch(() => null);
      return { credentials, problems: settings ? findProblems(settings) : [] };
    },
    onSuccess: ({ credentials, problems }) => {
      if (problems.length === 0) onLoggedIn(credentials);
    },
  });
  const problems = login.data?.problems ?? [];

  // Whatever was checked or reported no longer matches the form once it changes.
  const edit = (setValue: (value: string) => void) => (value: string) => {
    setValue(value);
    login.reset();
  };

  const canSubmit = [apiUrl, idInstance, apiTokenInstance].every(
    (value) => value.trim() !== '',
  );

  const handleSubmit: ComponentProps<'form'>['onSubmit'] = (event) => {
    event.preventDefault();
    login.mutate({
      apiUrl: apiUrl.trim(),
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    });
  };

  return (
    // Like MAX: a flat white screen on a phone, a card on the wallpaper from md.
    <main className="bg-bg md:bg-wallpaper flex min-h-full md:items-center md:justify-center md:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full px-4 py-8 md:max-w-145 md:rounded-card md:shadow-card md:bg-linear-to-b md:from-white/65 md:to-white/90 md:px-27.5 md:py-12 md:backdrop-blur-[25px]"
      >
        <h1 className="mb-6 text-center text-xl leading-6 font-semibold">
          Вход в GREEN-API
        </h1>

        <p className="text-text-tertiary mb-4 text-center text-[13px] leading-4">
          Адрес API, idInstance и apiTokenInstance указаны в{' '}
          <a
            href="https://console.green-api.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            личном кабинете GREEN-API
          </a>
          .
        </p>

        <fieldset disabled={login.isPending}>
          <Field
            label="Адрес API"
            value={apiUrl}
            onChange={edit(setApiUrl)}
            type="url"
          />
          <Field
            label="idInstance"
            value={idInstance}
            onChange={edit(setIdInstance)}
            placeholder="1101234567"
          />
          <Field
            label="apiTokenInstance"
            value={apiTokenInstance}
            onChange={edit(setApiTokenInstance)}
            placeholder="d75b3a66374942c5b3c19c…"
            type="password"
          />

          {login.isError && (
            <p
              role="alert"
              className="text-text-negative mb-2 text-[13px] leading-4"
            >
              {describeLoginError(login.error)}
            </p>
          )}

          {problems.length > 0 && login.data ? (
            <>
              <p
                role="alert"
                className="bg-bg-secondary mb-2 rounded-md p-3 text-[13px] leading-4"
              >
                Инстанс настроен не для получения сообщений через HTTP API:{' '}
                {problems.join(', ')}. Входящие сообщения могут не приходить.
                Исправьте настройки в личном кабинете GREEN-API или продолжите
                как есть.
              </p>
              <button
                type="button"
                onClick={() => onLoggedIn(login.data.credentials)}
                className={primaryButtonClass}
              >
                Продолжить
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={login.isPending}
              className={primaryButtonClass}
            >
              {login.isPending ? (
                <>
                  <Spinner />
                  Проверяем…
                </>
              ) : (
                'Войти'
              )}
            </button>
          )}
        </fieldset>
      </form>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: FieldProps) {
  return (
    <label className="mb-3 block">
      <span className="text-text-tertiary mb-1 block px-3 text-[13px] leading-4">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="rounded-lg bg-input caret-accent placeholder:text-text-tertiary h-13 w-full px-3 text-base leading-5 outline-none"
      />
    </label>
  );
}
