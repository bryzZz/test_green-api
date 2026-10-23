import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createFakeGreenApi } from '../../mocks/fake-green-api';
import { server } from '../../test/server';
import { createChatsStore } from './chats-store';
import { MainScreen } from './main-screen';

const credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

function renderMain() {
  const onLogout = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MainScreen credentials={credentials} onLogout={onLogout} />
    </QueryClientProvider>,
  );
  return { onLogout, user: userEvent.setup() };
}

async function startChat(
  user: ReturnType<typeof userEvent.setup>,
  digits: string,
) {
  await user.click(screen.getByRole('button', { name: 'Новый чат' }));
  await user.type(screen.getByLabelText('Номер телефона'), digits);
  await user.click(screen.getByRole('button', { name: 'Открыть чат' }));
}

beforeEach(() => {
  server.use(...createFakeGreenApi().handlers);
});

describe('MainScreen', () => {
  it('starts with an empty list and a hint', () => {
    renderMain();

    expect(screen.getByText(/Нет чатов/)).toBeInTheDocument();
  });

  it('opens a new chat for a registered number and lists it', async () => {
    const { user } = renderMain();

    await startChat(user, '9991234567');

    const header = await screen.findByRole('heading', {
      name: '+7 (999) 123-45-67',
    });
    expect(header).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /\+7 \(999\) 123-45-67/ }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the dialog open and the list empty for an unregistered number', async () => {
    const { user } = renderMain();

    await startChat(user, '9990000000');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Номер не зарегистрирован в MAX',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Нет чатов/)).toBeInTheDocument();
  });

  it('does not open a chat the user cancelled while the number was being looked up', async () => {
    server.use(
      http.post('*/waInstance:id/checkAccount/:token', async () => {
        await delay(100);
        return HttpResponse.json({ exist: true, chatId: '10000001' });
      }),
    );
    const { user } = renderMain();
    await startChat(user, '9991234567');

    await user.keyboard('{Escape}');
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/Нет чатов/)).toBeInTheDocument();
  });

  it('gives a chat that only had an id the name of the number it was opened by', async () => {
    createChatsStore(credentials.idInstance)
      .getState()
      .applyEvent({
        type: 'message',
        direction: 'incoming',
        idMessage: 'A1',
        chatId: '10000001',
        timestamp: Math.floor(Date.now() / 1000),
        content: { kind: 'text', text: 'Привет' },
      });
    const { user } = renderMain();

    await startChat(user, '9991234567');

    expect(
      await screen.findByRole('heading', { name: '+7 (999) 123-45-67' }),
    ).toBeInTheDocument();
  });

  it('opens the existing chat instead of adding a second one for the same number', async () => {
    const { user } = renderMain();
    await startChat(user, '9991234567');
    await screen.findByRole('heading', { name: '+7 (999) 123-45-67' });
    await user.click(screen.getByRole('button', { name: 'Назад к списку' }));

    await startChat(user, '9991234567');

    await screen.findByRole('heading', { name: '+7 (999) 123-45-67' });
    expect(
      screen.getAllByRole('button', { name: /\+7 \(999\) 123-45-67/ }),
    ).toHaveLength(1);
  });

  it('shows the chats saved for this instance', () => {
    createChatsStore(credentials.idInstance)
      .getState()
      .applyEvent({
        type: 'message',
        direction: 'incoming',
        idMessage: 'A1',
        chatId: '10000009',
        chatName: 'Анна',
        timestamp: Math.floor(Date.now() / 1000),
        content: { kind: 'text', text: 'Привет' },
      });

    renderMain();

    expect(screen.getByRole('button', { name: /Анна/ })).toBeInTheDocument();
  });

  it('opens a chat from the list and goes back to the list', async () => {
    createChatsStore(credentials.idInstance).getState().openChat({
      chatId: '10000009',
      name: 'Анна',
    });
    const { user } = renderMain();

    await user.click(screen.getByRole('button', { name: /Анна/ }));
    expect(screen.getByRole('heading', { name: 'Анна' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Назад к списку' }));
    expect(
      screen.queryByRole('heading', { name: 'Анна' }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: /Анна/,
      }),
    ).not.toHaveAttribute('aria-current');
  });

  it('logs out', async () => {
    const { onLogout, user } = renderMain();

    await user.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(onLogout).toHaveBeenCalled();
  });
});
