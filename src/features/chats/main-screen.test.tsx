import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createFakeGreenApi } from '../../mocks/fake-green-api';
import { server } from '../../test/server';
import { createChatsStore } from './chats-store';
import { MainScreen } from './main-screen';

// Plain http on purpose: see polling.test.ts (MSW's TLS emulation misbehaves
// when the polling loop is aborted in flight as the screen is closed).
const credentials = {
  apiUrl: 'http://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

function renderMain() {
  const onLogout = vi.fn();
  const onSessionExpired = vi.fn();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MainScreen
        credentials={credentials}
        onLogout={onLogout}
        onSessionExpired={onSessionExpired}
      />
    </QueryClientProvider>,
  );
  return { onLogout, onSessionExpired, view, user: userEvent.setup() };
}

// A quick fake API: the echo bot answers within a few dozen milliseconds and
// an empty queue is not held for long.
const fastApi = {
  deliveredDelayMs: 10,
  readDelayMs: 30,
  echoDelayMs: 60,
  maxHoldMs: 100,
};

async function startChat(
  user: ReturnType<typeof userEvent.setup>,
  digits: string,
) {
  await user.click(screen.getByRole('button', { name: 'Новый чат' }));
  await user.type(screen.getByLabelText('Номер телефона'), digits);
  await user.click(screen.getByRole('button', { name: 'Открыть чат' }));
}

beforeEach(() => {
  server.use(...createFakeGreenApi(fastApi).handlers);
});

const receiveUrl = '*/waInstance:id/receiveNotification/:token';

describe('MainScreen receiving', () => {
  it('shows the reply and the read marks that come back after sending', async () => {
    const { user } = renderMain();
    await startChat(user, '9991234567');
    await user.type(
      screen.getByRole('textbox', { name: 'Сообщение' }),
      'Привет{Enter}',
    );

    // The echo bot answers with the same text, so it is shown twice.
    await vi.waitFor(() =>
      expect(screen.getAllByText('Привет').length).toBeGreaterThanOrEqual(3),
    );
    const mine = screen
      .getAllByText('Привет')
      .map((e) => e.closest('[data-direction]'))
      .filter(
        (e): e is HTMLElement =>
          e?.getAttribute('data-direction') === 'outgoing',
      );
    expect(
      await within(mine[0]).findByLabelText('Прочитано'),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByText('Привет')
        .some(
          (e) =>
            e.closest('[data-direction]')?.getAttribute('data-direction') ===
            'incoming',
        ),
    ).toBe(true);
  });

  it('opens a chat for a message from someone new', async () => {
    const queue = [
      {
        receiptId: 1,
        body: {
          typeWebhook: 'incomingMessageReceived',
          timestamp: Math.floor(Date.now() / 1000),
          idMessage: 'IN1',
          senderData: {
            chatId: '10000009',
            sender: '10000009',
            chatName: 'Анна',
          },
          messageData: {
            typeMessage: 'textMessage',
            textMessageData: { textMessage: 'Здравствуйте!' },
          },
        },
      },
    ];
    server.use(
      http.get(receiveUrl, async () => {
        if (queue.length === 0) await delay(50);
        return HttpResponse.json(queue[0] ?? null);
      }),
      http.delete(
        '*/waInstance:id/deleteNotification/:token/:receiptId',
        () => {
          queue.shift();
          return HttpResponse.json({ result: true });
        },
      ),
    );
    renderMain();

    const row = await screen.findByRole('button', { name: /Анна/ });

    expect(within(row).getByText('Здравствуйте!')).toBeInTheDocument();
  });

  it('says it is waiting for the network while the connection is down, and stops saying it once it is back', async () => {
    let broken = true;
    server.use(
      http.get(receiveUrl, () => (broken ? HttpResponse.error() : undefined)),
    );
    renderMain();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Ожидание сети',
    );

    broken = false;
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    );
  });

  it('says the session is over when the credentials are rejected', async () => {
    server.use(
      http.get(receiveUrl, () => HttpResponse.json({}, { status: 401 })),
    );

    const { onSessionExpired } = renderMain();

    await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
  });

  it('stops asking GREEN-API for messages when the screen is closed', async () => {
    let requests = 0;
    server.use(
      http.get(receiveUrl, async () => {
        requests += 1;
        await delay(20);
        return HttpResponse.json(null);
      }),
    );
    const { view } = renderMain();
    await vi.waitFor(() => expect(requests).toBeGreaterThan(1));

    view.unmount();
    const after = requests;
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(requests).toBeLessThanOrEqual(after + 1);
  });
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
