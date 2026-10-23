import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createFakeGreenApi } from '../../mocks/fake-green-api';
import { server } from '../../test/server';
import { NewChatDialog } from './new-chat-dialog';

const credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

function renderDialog(
  knownChatId: (phone: string) => string | undefined = () => undefined,
) {
  const onResolved = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewChatDialog
        credentials={credentials}
        knownChatId={knownChatId}
        onResolved={onResolved}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onResolved, onClose, user: userEvent.setup() };
}

const phoneField = () => screen.getByLabelText('Номер телефона');
const submit = () => screen.getByRole('button', { name: 'Открыть чат' });

describe('NewChatDialog phone field', () => {
  it.each([
    ['9991234567', '+7 (999) 123-45-67'],
    ['89991234567', '+7 (999) 123-45-67'],
    ['+79991234567', '+7 (999) 123-45-67'],
  ])('shows %s as %s', async (typed, shown) => {
    const { user } = renderDialog();

    await user.type(phoneField(), typed);

    expect(phoneField()).toHaveValue(shown);
  });

  it('keeps the button disabled until the whole number is typed', async () => {
    const { user } = renderDialog();
    expect(submit()).toBeDisabled();

    await user.type(phoneField(), '999123456');
    expect(submit()).toBeDisabled();

    await user.type(phoneField(), '7');
    expect(submit()).toBeEnabled();
  });
});

describe('NewChatDialog lookup', () => {
  it('resolves a registered number to its chat id', async () => {
    server.use(...createFakeGreenApi().handlers);
    const { onResolved, user } = renderDialog();

    await user.type(phoneField(), '9991234567');
    await user.click(submit());

    await vi.waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith({
        phone: '79991234567',
        chatId: '10000001',
      }),
    );
  });

  it('skips the request for a number it already knows', async () => {
    // No handlers are registered, so any request would fail the test.
    const { onResolved, user } = renderDialog((phone) =>
      phone === '79991234567' ? '10000042' : undefined,
    );

    await user.type(phoneField(), '9991234567');
    await user.click(submit());

    await vi.waitFor(() =>
      expect(onResolved).toHaveBeenCalledWith({
        phone: '79991234567',
        chatId: '10000042',
      }),
    );
  });

  it('says so when the number is not registered in MAX', async () => {
    server.use(...createFakeGreenApi().handlers);
    const { onResolved, user } = renderDialog();

    await user.type(phoneField(), '9990000000');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Номер не зарегистрирован в MAX',
    );
    expect(onResolved).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it.each([
    [
      'a lost connection',
      () => HttpResponse.error(),
      'Нет соединения с сервером',
    ],
    [
      'rate limiting',
      () => HttpResponse.json({}, { status: 429 }),
      'Слишком много запросов',
    ],
    [
      'rejected credentials',
      () => HttpResponse.json({}, { status: 401 }),
      'Войдите заново',
    ],
    [
      'a server error',
      () => HttpResponse.json({}, { status: 500 }),
      'Не удалось найти номер',
    ],
  ])('explains %s', async (_name, respond, text) => {
    server.use(http.post('*/waInstance:id/checkAccount/:token', respond));
    const { user } = renderDialog();

    await user.type(phoneField(), '9991234567');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(submit()).toBeEnabled();
  });

  it('disables the form while it looks the number up', async () => {
    server.use(
      http.post('*/waInstance:id/checkAccount/:token', async () => {
        await delay(100);
        return HttpResponse.json({ exist: true, chatId: '10000001' });
      }),
    );
    const { onResolved, user } = renderDialog();

    await user.type(phoneField(), '9991234567');
    await user.click(submit());

    expect(screen.getByRole('button', { name: 'Ищем…' })).toBeDisabled();
    expect(phoneField()).toBeDisabled();
    await vi.waitFor(() => expect(onResolved).toHaveBeenCalled());
  });

  it('forgets the error once the number is edited', async () => {
    server.use(...createFakeGreenApi().handlers);
    const { user } = renderDialog();
    await user.type(phoneField(), '9990000000');
    await user.click(submit());
    await screen.findByRole('alert');

    await user.type(phoneField(), '{Backspace}');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('NewChatDialog closing', () => {
  it('closes with the button and with Escape', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Закрыть' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
