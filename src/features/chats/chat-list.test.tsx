import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatList } from './chat-list';
import type { Chat, Message } from './chats-store';

// Today at 19:10 local time, whatever day the tests run on.
const todayAt1910 = new Date().setHours(19, 10, 0, 0) / 1000;

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    idMessage: 'm1',
    direction: 'incoming',
    content: { kind: 'text', text: 'Привет' },
    timestamp: todayAt1910,
    ...overrides,
  };
}

function chat(overrides: Partial<Chat> = {}): Chat {
  return {
    chatId: '10000001',
    name: 'Иван Петров',
    createdAt: todayAt1910,
    messages: [message()],
    ...overrides,
  };
}

function renderList(chats: Chat[], activeChatId?: string) {
  const onSelect = vi.fn();
  render(
    <ChatList chats={chats} activeChatId={activeChatId} onSelect={onSelect} />,
  );
  return { onSelect, user: userEvent.setup() };
}

describe('ChatList', () => {
  it('shows the name, the last message, the time and the initials', () => {
    renderList([chat()]);

    const row = screen.getByRole('button', { name: /Иван Петров/ });
    expect(within(row).getByText('Иван Петров')).toBeInTheDocument();
    expect(within(row).getByText('Привет')).toBeInTheDocument();
    expect(within(row).getByText('19:10')).toBeInTheDocument();
    expect(within(row).getByText('ИП')).toBeInTheDocument();
  });

  it('previews the latest message', () => {
    renderList([
      chat({
        messages: [
          message({ id: 'a', content: { kind: 'text', text: 'Первое' } }),
          message({
            id: 'b',
            content: { kind: 'text', text: 'Последнее' },
            timestamp: todayAt1910 + 60,
          }),
        ],
      }),
    ]);

    expect(screen.getByText('Последнее')).toBeInTheDocument();
    expect(screen.queryByText('Первое')).not.toBeInTheDocument();
  });

  it('says so when the last message is not text', () => {
    renderList([
      chat({ messages: [message({ content: { kind: 'unsupported' } })] }),
    ]);

    expect(screen.getByText('Сообщение не поддерживается')).toBeInTheDocument();
  });

  it('shows a chat that has no messages yet without a time', () => {
    renderList([chat({ messages: [] })]);

    const row = screen.getByRole('button', { name: /Иван Петров/ });
    expect(within(row).queryByText('19:10')).not.toBeInTheDocument();
  });

  it('falls back to a generic avatar and the chat id when there is no name', () => {
    renderList([chat({ name: undefined })]);

    expect(screen.getByText('10000001')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
  });

  it.each([
    ['pending', 'Отправляется'],
    ['sent', 'Отправлено'],
    ['delivered', 'Доставлено'],
    ['read', 'Прочитано'],
    ['failed', 'Не отправлено'],
  ] as const)('marks an outgoing %s message as «%s»', (status, label) => {
    renderList([
      chat({ messages: [message({ direction: 'outgoing', status })] }),
    ]);

    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('shows no delivery mark for an incoming message', () => {
    renderList([chat()]);

    expect(screen.queryByLabelText('Отправлено')).not.toBeInTheDocument();
  });

  it('marks the open chat and reports the chat that was clicked', async () => {
    const { onSelect, user } = renderList(
      [chat(), chat({ chatId: '10000002', name: 'Анна' })],
      '10000002',
    );

    expect(screen.getByRole('button', { name: /Анна/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: /Иван/ })).not.toHaveAttribute(
      'aria-current',
    );

    await user.click(screen.getByRole('button', { name: /Иван/ }));

    expect(onSelect).toHaveBeenCalledWith('10000001');
  });

  it('shows how many messages are unread', () => {
    renderList([
      chat({
        messages: [
          message({ id: 'a', timestamp: todayAt1910 }),
          message({ id: 'b', timestamp: todayAt1910 + 60 }),
          message({ id: 'c', timestamp: todayAt1910 + 120 }),
        ],
      }),
    ]);

    const row = screen.getByRole('button', { name: /Иван Петров/ });
    expect(
      within(row).getByRole('img', { name: 'Непрочитанных: 3' }),
    ).toHaveTextContent('3');
  });

  it('shows no count when everything has been read', () => {
    renderList([chat({ lastReadId: 'm1' })]);

    expect(
      screen.queryByRole('img', { name: /Непрочитанных/ }),
    ).not.toBeInTheDocument();
  });

  it('does not count what the user wrote as unread', () => {
    renderList([
      chat({
        messages: [message({ direction: 'outgoing', status: 'sent' })],
      }),
    ]);

    expect(
      screen.queryByRole('img', { name: /Непрочитанных/ }),
    ).not.toBeInTheDocument();
  });

  it('says there are no messages instead of leaving a hole under the name', () => {
    renderList([chat({ messages: [] })]);

    const row = screen.getByRole('button', { name: /Иван Петров/ });
    expect(within(row).getByText('Нет сообщений')).toBeInTheDocument();
  });

  it('explains how to start when there are no chats', () => {
    renderList([]);

    expect(screen.getByText(/Нет чатов/)).toBeInTheDocument();
  });
});
