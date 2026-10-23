import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createFakeGreenApi } from '../../mocks/fake-green-api';
import { server } from '../../test/server';
import { LoginScreen } from './login-screen';

const cleanSettings = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
};

function renderLogin() {
  const onLoggedIn = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginScreen onLoggedIn={onLoggedIn} />
    </QueryClientProvider>,
  );
  return { onLoggedIn, user: userEvent.setup() };
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { idInstance = '1101000001', token = 'secret-token' } = {},
) {
  await user.type(screen.getByLabelText('idInstance'), idInstance);
  await user.type(screen.getByLabelText('apiTokenInstance'), token);
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

describe('LoginScreen instance settings', () => {
  const stateUrl = '*/waInstance:id/getStateInstance/:token';
  const settingsUrl = '*/waInstance:id/getSettings/:token';

  function authorized() {
    server.use(
      http.get(stateUrl, () =>
        HttpResponse.json({ stateInstance: 'authorized' }),
      ),
    );
  }

  it.each([
    [
      'a webhook URL is set',
      { webhookUrl: 'https://example.com/hook' },
      'webhookUrl',
    ],
    ['incoming webhooks are off', { incomingWebhook: 'no' }, 'incomingWebhook'],
    [
      'outgoing API webhooks are off',
      { outgoingAPIMessageWebhook: 'no' },
      'outgoingAPIMessageWebhook',
    ],
  ])(
    'warns when %s and waits for the user to continue',
    async (_name, override, setting) => {
      authorized();
      server.use(
        http.get(settingsUrl, () =>
          HttpResponse.json({ ...cleanSettings, ...override }),
        ),
      );
      const { onLoggedIn, user } = renderLogin();

      await fillAndSubmit(user);

      expect(await screen.findByRole('alert')).toHaveTextContent(setting);
      expect(onLoggedIn).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Продолжить' }));

      expect(onLoggedIn).toHaveBeenCalledWith({
        apiUrl: 'https://api.green-api.com',
        idInstance: '1101000001',
        apiTokenInstance: 'secret-token',
      });
    },
  );

  it('drops the warning when the credentials are edited, so they can be checked again', async () => {
    authorized();
    server.use(
      http.get(settingsUrl, () =>
        HttpResponse.json({
          ...cleanSettings,
          webhookUrl: 'https://example.com/hook',
        }),
      ),
    );
    const { onLoggedIn, user } = renderLogin();
    await fillAndSubmit(user);
    await screen.findByRole('button', { name: 'Продолжить' });

    server.use(http.get(settingsUrl, () => HttpResponse.json(cleanSettings)));
    await user.type(screen.getByLabelText('idInstance'), '2');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    await vi.waitFor(() =>
      expect(onLoggedIn).toHaveBeenCalledWith(
        expect.objectContaining({ idInstance: '11010000012' }),
      ),
    );
  });

  it('logs in anyway when the settings cannot be read', async () => {
    authorized();
    server.use(
      http.get(settingsUrl, () => HttpResponse.json({}, { status: 429 })),
    );
    const { onLoggedIn, user } = renderLogin();

    await fillAndSubmit(user);

    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
  });
});

describe('LoginScreen errors', () => {
  const stateUrl = '*/waInstance:id/getStateInstance/:token';

  it.each([
    [
      'rejected credentials (401)',
      () => HttpResponse.json({}, { status: 401 }),
      'Неверный idInstance или apiTokenInstance',
    ],
    [
      'forbidden credentials (403)',
      () => HttpResponse.json({}, { status: 403 }),
      'Неверный idInstance или apiTokenInstance',
    ],
    [
      'an instance that is not authorized',
      () => HttpResponse.json({ stateInstance: 'notAuthorized' }),
      'Инстанс не авторизован',
    ],
    [
      'a lost connection',
      () => HttpResponse.error(),
      'Нет соединения с сервером',
    ],
    [
      'rate limiting (429)',
      () => HttpResponse.json({}, { status: 429 }),
      'Слишком много запросов',
    ],
    [
      'a server error (500)',
      () => HttpResponse.json({}, { status: 500 }),
      'Не удалось войти',
    ],
  ])(
    'explains %s and lets the user try again',
    async (_name, respond, text) => {
      server.use(http.get(stateUrl, respond));
      const { onLoggedIn, user } = renderLogin();

      await fillAndSubmit(user);

      expect(await screen.findByRole('alert')).toHaveTextContent(text);
      expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
      expect(onLoggedIn).not.toHaveBeenCalled();
    },
  );
});

describe('LoginScreen form', () => {
  it('keeps the login button disabled until every field has a value', async () => {
    const { user } = renderLogin();
    const button = screen.getByRole('button', { name: 'Войти' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('idInstance'), '1101000001');
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('apiTokenInstance'), '   ');
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token');
    expect(button).toBeEnabled();

    await user.clear(screen.getByLabelText('Адрес API'));
    expect(button).toBeDisabled();
  });
});

describe('LoginScreen while checking', () => {
  it('disables the form and shows a spinner until the check finishes', async () => {
    server.use(
      http.get('*/waInstance:id/getStateInstance/:token', async () => {
        await delay(100);
        return HttpResponse.json({ stateInstance: 'authorized' });
      }),
      http.get('*/waInstance:id/getSettings/:token', () =>
        HttpResponse.json(cleanSettings),
      ),
    );
    const { onLoggedIn, user } = renderLogin();

    await fillAndSubmit(user);

    const button = screen.getByRole('button', { name: 'Проверяем…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('idInstance')).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalled());
  });
});

describe('LoginScreen', () => {
  it('logs in with the entered credentials once the instance is authorized', async () => {
    server.use(...createFakeGreenApi().handlers);
    const { onLoggedIn, user } = renderLogin();

    await fillAndSubmit(user, {
      idInstance: ' 1101000001 ',
      token: ' secret-token ',
    });

    await vi.waitFor(() =>
      expect(onLoggedIn).toHaveBeenCalledWith({
        apiUrl: 'https://api.green-api.com',
        idInstance: '1101000001',
        apiTokenInstance: 'secret-token',
      }),
    );
  });
});
