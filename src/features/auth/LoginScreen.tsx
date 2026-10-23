import { useMutation } from '@tanstack/react-query';
import { useState, type ComponentProps } from 'react';
import type { Credentials } from '@/api/createGreenApiClient';
import { Field } from '@/shared/ui/Field';
import { PrimaryButton } from '@/shared/ui/PrimaryButton';
import { Spinner } from '@/shared/ui/Spinner';
import { describeLoginError } from './lib/describeLoginError';
import { verifyInstance } from './lib/verifyInstance';
import { SettingsWarning } from './SettingsWarning';

const DEFAULT_API_URL = 'https://api.green-api.com';

type LoginScreenProps = {
  onLoggedIn: (credentials: Credentials) => void;
  /** Why the user is asked to log in again, e.g. rejected credentials. */
  notice?: string;
};

export const LoginScreen = ({ onLoggedIn, notice }: LoginScreenProps) => {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');

  const login = useMutation({
    mutationFn: verifyInstance,
    onSuccess: ({ credentials, problems }) => {
      if (problems.length > 0) return;
      onLoggedIn(credentials);
    },
  });

  const problems = login.data?.problems ?? [];
  const canSubmit = [apiUrl, idInstance, apiTokenInstance].every(
    (value) => value.trim() !== '',
  );

  // Whatever was checked or reported no longer matches the form once it changes.
  const handleApiUrlChange = (value: string) => {
    setApiUrl(value);
    login.reset();
  };

  const handleIdInstanceChange = (value: string) => {
    setIdInstance(value);
    login.reset();
  };

  const handleApiTokenChange = (value: string) => {
    setApiTokenInstance(value);
    login.reset();
  };

  const handleSubmit: ComponentProps<'form'>['onSubmit'] = (event) => {
    event.preventDefault();
    login.mutate({
      apiUrl: apiUrl.trim(),
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    });
  };

  const handleContinue = () => {
    if (!login.data) return;
    onLoggedIn(login.data.credentials);
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

        {notice && (
          <p
            role="status"
            className="bg-bg-secondary mb-4 rounded-md p-3 text-center text-[13px] leading-4"
          >
            {notice}
          </p>
        )}

        <fieldset disabled={login.isPending}>
          <Field
            label="Адрес API"
            value={apiUrl}
            onChange={handleApiUrlChange}
            type="url"
          />
          <Field
            label="idInstance"
            value={idInstance}
            onChange={handleIdInstanceChange}
            placeholder="1101234567"
          />
          <Field
            label="apiTokenInstance"
            value={apiTokenInstance}
            onChange={handleApiTokenChange}
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

          {problems.length > 0 ? (
            <SettingsWarning problems={problems} onContinue={handleContinue} />
          ) : (
            <PrimaryButton
              type="submit"
              disabled={!canSubmit}
              aria-busy={login.isPending}
            >
              {login.isPending ? (
                <>
                  <Spinner />
                  Проверяем…
                </>
              ) : (
                'Войти'
              )}
            </PrimaryButton>
          )}
        </fieldset>
      </form>
    </main>
  );
};
