import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createFakeGreenApi } from '@/mocks/createFakeGreenApi';
import { credentials } from '@/test/factories';
import { server } from '@/test/server';
import { createChatsStore } from '../store/chatsStore';
import { ChatWindow } from './ChatWindow';

const chatId = '10000001';
const sendUrl = '*/waInstance:id/sendMessage/:token';

const renderWindow = () => {
  const store = createChatsStore(credentials.idInstance);
  store.getState().openChat({ chatId, name: 'Анна' });
  const onBack = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatWindow
        credentials={credentials}
        store={store}
        chatId={chatId}
        onBack={onBack}
      />
    </QueryClientProvider>,
  );
  return { store, onBack, user: userEvent.setup() };
};

const write = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) => {
  await user.type(
    screen.getByRole('textbox', { name: 'Сообщение' }),
    `${text}{Enter}`,
  );
};

describe('ChatWindow header', () => {
  it('shows who the chat is with and goes back', async () => {
    const { onBack, user } = renderWindow();

    expect(screen.getByRole('heading', { name: 'Анна' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Назад к списку' }));

    expect(onBack).toHaveBeenCalled();
  });

  it('shows the messages the chat already has', () => {
    const store = createChatsStore(credentials.idInstance);
    store.getState().applyEvent({
      type: 'message',
      direction: 'incoming',
      idMessage: 'A1',
      chatId,
      chatName: 'Анна',
      timestamp: Math.floor(Date.now() / 1000),
      content: { kind: 'text', text: 'Привет, как дела?' },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChatWindow
          credentials={credentials}
          store={store}
          chatId={chatId}
          onBack={() => {}}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Привет, как дела?')).toBeInTheDocument();
  });
});

describe('ChatWindow sending', () => {
  it('shows the message at once and marks it sent when the API accepts it', async () => {
    server.use(
      http.post(sendUrl, async () => {
        await delay(100);
        return HttpResponse.json({ idMessage: 'API1' });
      }),
    );
    const { user } = renderWindow();

    await write(user, 'Привет');

    const bubble = screen
      .getByText('Привет')
      .closest('[data-direction]') as HTMLElement;
    expect(within(bubble).getByLabelText('Отправляется')).toBeInTheDocument();
    expect(
      await within(bubble).findByLabelText('Отправлено'),
    ).toBeInTheDocument();
  });

  it('sends the chat id and the text to GREEN-API', async () => {
    let body: unknown;
    server.use(
      http.post(sendUrl, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ idMessage: 'API1' });
      }),
    );
    const { user } = renderWindow();

    await write(user, 'Привет');

    await vi.waitFor(() => expect(body).toEqual({ chatId, message: 'Привет' }));
  });

  it('sends nothing for an empty message', async () => {
    // No handlers are registered, so any request would fail the test.
    const { store, user } = renderWindow();

    await write(user, '   ');

    expect(store.getState().chats[chatId].messages).toEqual([]);
  });

  it('keeps the message and says why when the tariff does not allow a new chat', async () => {
    server.use(...createFakeGreenApi({ chatQuota: 0 }).handlers);
    const { user } = renderWindow();

    await write(user, 'Привет');

    expect(await screen.findByRole('alert')).toHaveTextContent('лимит тарифа');
    expect(screen.getByText('Привет')).toBeInTheDocument();
  });

  it.each([
    ['a lost connection', () => HttpResponse.error(), 'нет соединения'],
    [
      'rate limiting',
      () => HttpResponse.json({}, { status: 429 }),
      'слишком много запросов',
    ],
    [
      'rejected credentials',
      () => HttpResponse.json({}, { status: 401 }),
      'учётные данные',
    ],
    [
      'a server error',
      () => HttpResponse.json({}, { status: 500 }),
      'что-то пошло не так',
    ],
  ])(
    'keeps the message and says why after %s',
    async (_name, respond, reason) => {
      server.use(http.post(sendUrl, respond));
      const { user } = renderWindow();

      await write(user, 'Привет');

      expect(await screen.findByRole('alert')).toHaveTextContent(reason);
      expect(screen.getByText('Привет')).toBeInTheDocument();
    },
  );

  it('lets the user write again after a failure', async () => {
    // The handler added last wins, so the one-off failure goes second.
    server.use(
      http.post(sendUrl, () => HttpResponse.json({ idMessage: 'API2' })),
    );
    server.use(http.post(sendUrl, () => HttpResponse.error(), { once: true }));
    const { user } = renderWindow();

    await write(user, 'Первое');
    await screen.findByRole('alert');
    await write(user, 'Второе');

    const second = screen
      .getByText('Второе')
      .closest('[data-direction]') as HTMLElement;
    expect(
      await within(second).findByLabelText('Отправлено'),
    ).toBeInTheDocument();
  });
});
