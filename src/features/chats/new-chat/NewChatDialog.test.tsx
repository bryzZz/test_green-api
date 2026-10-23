import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createFakeGreenApi } from '@/mocks/createFakeGreenApi';
import { credentials } from '@/test/factories';
import { server } from '@/test/server';
import { NewChatDialog } from './NewChatDialog';

const renderDialog = (
  knownChatId: (phone: string) => string | undefined = () => undefined,
  /** Something on the page behind the dialog. */
  pageBehind?: ReactNode,
) => {
  const onResolved = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      {pageBehind}
      <NewChatDialog
        credentials={credentials}
        knownChatId={knownChatId}
        onResolved={onResolved}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onResolved, onClose, user: userEvent.setup() };
};

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

describe('NewChatDialog focus', () => {
  it('starts in the phone field', () => {
    renderDialog();

    expect(phoneField()).toHaveFocus();
  });

  it('keeps Tab inside the dialog, going round from the last control to the first', async () => {
    const { user } = renderDialog();
    const close = screen.getByRole('button', { name: 'Закрыть' });
    await user.type(phoneField(), '9991234567');

    // field → submit → (wraps) close → field
    await user.tab();
    expect(submit()).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(phoneField()).toHaveFocus();
  });

  it('keeps Shift+Tab inside too, going round from the first control to the last', async () => {
    const { user } = renderDialog();
    const close = screen.getByRole('button', { name: 'Закрыть' });
    await user.type(phoneField(), '9991234567');
    await user.tab({ shift: true }); // field → close
    expect(close).toHaveFocus();

    await user.tab({ shift: true });

    expect(submit()).toHaveFocus();
  });

  it('keeps Tab inside even after the focused button was disabled by the lookup', async () => {
    server.use(
      http.post('*/waInstance:id/checkAccount/:token', async () => {
        await delay(200);
        return HttpResponse.json({ exist: true, chatId: '10000001' });
      }),
    );
    const { user } = renderDialog(undefined, <button>Page behind</button>);
    await user.type(phoneField(), '9991234567');
    await user.tab();
    await user.keyboard('{Enter}'); // submit has the focus and turns disabled
    expect(screen.getByRole('button', { name: 'Ищем…' })).toBeDisabled();
    // A browser drops the focus of a control that gets disabled; jsdom doesn't.
    (document.activeElement as HTMLElement).blur();

    await user.tab();

    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement,
    );
    expect(
      screen.getByRole('button', { name: 'Page behind' }),
    ).not.toHaveFocus();
  });

  it('skips the submit button while it is disabled', async () => {
    const { user } = renderDialog();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus();
    await user.tab();

    expect(phoneField()).toHaveFocus();
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
