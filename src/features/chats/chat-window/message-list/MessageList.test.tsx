import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import type { Message } from '@/features/chats/store/types';
import { DAY, message, todayAt1910 } from '@/test/factories';
import { MessageList } from './MessageList';

const bubbleOf = (text: string) =>
  screen.getByText(text).closest('[data-direction]') as HTMLElement;

// jsdom does no layout, so the scroll geometry is faked: the content is
// `layout.content` tall inside a viewport of `layout.viewport`.
const layout = { content: 1000, viewport: 500 };
const scrollTops = new WeakMap<Element, number>();

const fakeScrolling = () => {
  const proto = HTMLElement.prototype;
  Object.defineProperties(proto, {
    scrollHeight: { configurable: true, get: () => layout.content },
    clientHeight: { configurable: true, get: () => layout.viewport },
    scrollTop: {
      configurable: true,
      get() {
        return scrollTops.get(this) ?? 0;
      },
      set(value: number) {
        scrollTops.set(this, value);
      },
    },
  });
};

const restoreScrolling = () => {
  for (const name of ['scrollHeight', 'clientHeight', 'scrollTop']) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
  }
};

describe('MessageList scrolling', () => {
  beforeEach(() => {
    layout.content = 1000;
    fakeScrolling();
  });
  afterEach(restoreScrolling);

  const scroller = (container: HTMLElement) =>
    container.firstElementChild as HTMLElement;

  const mine = (id: string, status: Message['status'] = 'sent') =>
    message({ id, direction: 'outgoing', status });

  it('starts at the bottom', () => {
    const { container } = render(<MessageList messages={[message()]} />);

    expect(scroller(container).scrollTop).toBe(1000);
  });

  it('follows the list when it grows taller because a failed message gets its reason', () => {
    const { container, rerender } = render(
      <MessageList messages={[mine('a', 'pending')]} />,
    );

    layout.content = 1060; // the reason line under the bubble
    rerender(
      <MessageList
        messages={[{ ...mine('a'), status: 'failed', errorKind: 'network' }]}
      />,
    );

    expect(scroller(container).scrollTop).toBe(1060);
  });

  it('does not pull the reader down for a status change while they read older messages', () => {
    const { container, rerender } = render(
      <MessageList messages={[mine('a', 'sent')]} />,
    );
    scroller(container).scrollTop = 0;
    fireEvent.scroll(scroller(container));

    rerender(<MessageList messages={[mine('a', 'read')]} />);

    expect(scroller(container).scrollTop).toBe(0);
  });

  it('leaves the reader where they are when a message arrives', () => {
    const { container, rerender } = render(
      <MessageList messages={[message()]} />,
    );
    scroller(container).scrollTop = 0;
    fireEvent.scroll(scroller(container));

    rerender(<MessageList messages={[message(), message({ id: 'b' })]} />);

    expect(scroller(container).scrollTop).toBe(0);
  });

  it('brings the reader to the bottom when they send a message', () => {
    const { container, rerender } = render(
      <MessageList messages={[message()]} />,
    );
    scroller(container).scrollTop = 0;
    fireEvent.scroll(scroller(container));

    layout.content = 1100;
    rerender(<MessageList messages={[message(), mine('b', 'pending')]} />);

    expect(scroller(container).scrollTop).toBe(1100);
  });

  it('keeps following afterwards, as the reader is at the bottom again', () => {
    const { container, rerender } = render(
      <MessageList messages={[message()]} />,
    );
    scroller(container).scrollTop = 0;
    fireEvent.scroll(scroller(container));
    rerender(<MessageList messages={[message(), mine('b', 'pending')]} />);

    layout.content = 1200;
    rerender(
      <MessageList
        messages={[
          message(),
          { ...mine('b'), status: 'failed', errorKind: 'quota' },
        ]}
      />,
    );

    expect(scroller(container).scrollTop).toBe(1200);
  });
});

describe('MessageList opening on the unread bar', () => {
  beforeEach(() => {
    layout.content = 2000;
    fakeScrolling();
    // The bar is 300px below the top of the content; like in a browser, it
    // moves up as the scroller is scrolled. Everything else is at 0.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const scroller = this.closest('[class*="overflow-y"]');
        const scrolled = scroller ? (scrollTops.get(scroller) ?? 0) : 0;
        const top = this.dataset.testid === 'unread-bar' ? 300 - scrolled : 0;
        return {
          top,
          bottom: top,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: top,
          toJSON: () => ({}),
        };
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    restoreScrolling();
  });

  const messages = [
    message({ id: '1', timestamp: todayAt1910 }),
    message({ id: '2', timestamp: todayAt1910 + 60 }),
  ];

  it('brings the bar to the top of the list instead of going to the bottom', () => {
    const { container } = render(
      <MessageList messages={messages} unreadFromId="2" />,
    );

    expect((container.firstElementChild as HTMLElement).scrollTop).toBe(300);
  });

  it('does the same under StrictMode, which runs the effects twice', () => {
    const { container } = render(
      <StrictMode>
        <MessageList messages={messages} unreadFromId="2" />
      </StrictMode>,
    );

    expect((container.firstElementChild as HTMLElement).scrollTop).toBe(300);
  });
});

describe('MessageList unread marker', () => {
  const text = (value: string) => ({ kind: 'text' as const, text: value });
  const before = (a: HTMLElement, b: HTMLElement) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('puts a «Новые сообщения» bar before the first unread message', () => {
    render(
      <MessageList
        unreadFromId="2"
        messages={[
          message({ id: '1', content: text('seen') }),
          message({ id: '2', content: text('new one') }),
          message({ id: '3', content: text('new two') }),
        ]}
      />,
    );

    const bar = screen.getByText('Новые сообщения');
    expect(before(bubbleOf('seen'), bar)).toBe(true);
    expect(before(bar, bubbleOf('new one'))).toBe(true);
    expect(screen.getAllByText('Новые сообщения')).toHaveLength(1);
  });

  it('puts the bar above the day label when the unread messages begin a new day', () => {
    render(
      <MessageList
        unreadFromId="2"
        messages={[
          message({
            id: '1',
            content: text('old'),
            timestamp: todayAt1910 - DAY,
          }),
          message({ id: '2', content: text('fresh'), timestamp: todayAt1910 }),
        ]}
      />,
    );

    const bar = screen.getByText('Новые сообщения');
    const label = screen.getAllByTestId('day-label')[1];
    expect(before(bar, label)).toBe(true);
    expect(before(label, bubbleOf('fresh'))).toBe(true);
  });

  it('shows no bar when nothing is unread', () => {
    render(<MessageList messages={[message()]} />);

    expect(screen.queryByText('Новые сообщения')).not.toBeInTheDocument();
  });
});

describe('MessageList grouping', () => {
  const text = (value: string) => ({ kind: 'text' as const, text: value });
  const positions = (...labels: string[]) =>
    labels.map((label) => bubbleOf(label).getAttribute('data-position'));

  it('treats a lone message as single', () => {
    render(<MessageList messages={[message({ content: text('a') })]} />);

    expect(positions('a')).toEqual(['single']);
  });

  it('groups messages from the same sender that follow each other', () => {
    render(
      <MessageList
        messages={[
          message({ id: '1', content: text('a'), timestamp: todayAt1910 }),
          message({ id: '2', content: text('b'), timestamp: todayAt1910 + 60 }),
          message({
            id: '3',
            content: text('c'),
            timestamp: todayAt1910 + 120,
          }),
        ]}
      />,
    );

    expect(positions('a', 'b', 'c')).toEqual(['first', 'middle', 'last']);
  });

  it('groups outgoing messages the same way', () => {
    render(
      <MessageList
        messages={[
          message({
            id: '1',
            direction: 'outgoing',
            status: 'sent',
            content: text('a'),
          }),
          message({
            id: '2',
            direction: 'outgoing',
            status: 'sent',
            content: text('b'),
          }),
        ]}
      />,
    );

    expect(positions('a', 'b')).toEqual(['first', 'last']);
  });

  it('starts a new group when the sender changes', () => {
    render(
      <MessageList
        messages={[
          message({ id: '1', content: text('a') }),
          message({
            id: '2',
            direction: 'outgoing',
            status: 'sent',
            content: text('b'),
          }),
          message({ id: '3', content: text('c') }),
        ]}
      />,
    );

    expect(positions('a', 'b', 'c')).toEqual(['single', 'single', 'single']);
  });

  it('starts a new group on a new day', () => {
    render(
      <MessageList
        messages={[
          message({
            id: '1',
            content: text('a'),
            timestamp: todayAt1910 - DAY,
          }),
          message({ id: '2', content: text('b'), timestamp: todayAt1910 }),
        ]}
      />,
    );

    expect(positions('a', 'b')).toEqual(['single', 'single']);
  });

  it('keeps a group together however long the pause was within the day', () => {
    render(
      <MessageList
        messages={[
          message({
            id: '1',
            content: text('a'),
            timestamp: todayAt1910 - 80 * 60,
          }),
          message({ id: '2', content: text('b'), timestamp: todayAt1910 }),
        ]}
      />,
    );

    expect(positions('a', 'b')).toEqual(['first', 'last']);
  });
});

describe('MessageList', () => {
  it('shows the messages in order, each on the side it came from', () => {
    render(
      <MessageList
        messages={[
          message({ id: 'a', content: { kind: 'text', text: 'Вопрос' } }),
          message({
            id: 'b',
            direction: 'outgoing',
            status: 'sent',
            content: { kind: 'text', text: 'Ответ' },
            timestamp: todayAt1910 + 60,
          }),
        ]}
      />,
    );

    expect(bubbleOf('Вопрос')).toHaveAttribute('data-direction', 'incoming');
    expect(bubbleOf('Ответ')).toHaveAttribute('data-direction', 'outgoing');
    expect(
      screen
        .getByText('Вопрос')
        .compareDocumentPosition(screen.getByText('Ответ')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('keeps line breaks of a message', () => {
    render(
      <MessageList
        messages={[message({ content: { kind: 'text', text: 'one\ntwo' } })]}
      />,
    );

    expect(screen.getByText(/one/)).toHaveClass('whitespace-pre-wrap');
  });

  it('shows the time of each message', () => {
    render(<MessageList messages={[message()]} />);

    expect(within(bubbleOf('Привет')).getByText('19:10')).toBeInTheDocument();
  });

  it.each([
    ['pending', 'Отправляется'],
    ['sent', 'Отправлено'],
    ['delivered', 'Доставлено'],
    ['read', 'Прочитано'],
  ] as const)('marks an outgoing %s message as «%s»', (status, label) => {
    render(
      <MessageList messages={[message({ direction: 'outgoing', status })]} />,
    );

    expect(
      within(bubbleOf('Привет')).getByLabelText(label),
    ).toBeInTheDocument();
  });

  it('shows no delivery mark on an incoming message', () => {
    render(<MessageList messages={[message()]} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('says so instead of showing something that is not text', () => {
    render(
      <MessageList
        messages={[message({ content: { kind: 'unsupported' } })]}
      />,
    );

    expect(screen.getByText('Сообщение не поддерживается')).toBeInTheDocument();
  });

  it.each([
    ['quota', 'достигнут лимит тарифа'],
    ['network', 'нет соединения'],
    ['unauthorized', 'учётные данные больше не действуют'],
    ['rateLimited', 'слишком много запросов'],
    ['server', 'что-то пошло не так'],
    [undefined, 'Не удалось отправить'],
  ] as const)('explains why a message failed (%s)', (errorKind, reason) => {
    render(
      <MessageList
        messages={[
          message({ direction: 'outgoing', status: 'failed', errorKind }),
        ]}
      />,
    );

    expect(
      within(bubbleOf('Привет')).getByLabelText('Не отправлено'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(reason);
  });

  it('separates the days with a label, once per day', () => {
    render(
      <MessageList
        messages={[
          message({ id: 'a', timestamp: todayAt1910 - 2 * DAY }),
          message({ id: 'b', timestamp: todayAt1910 - DAY }),
          message({ id: 'c', timestamp: todayAt1910 - DAY + 60 }),
          message({ id: 'd', timestamp: todayAt1910 }),
        ]}
      />,
    );

    expect(
      screen.getAllByTestId('day-label').map((e) => e.textContent),
    ).toEqual([expect.stringMatching(/^\d{1,2} [а-я]+/), 'Вчера', 'Сегодня']);
  });

  it('invites to write first when there are no messages', () => {
    render(<MessageList messages={[]} />);

    expect(screen.getByText(/Сообщений пока нет/)).toBeInTheDocument();
  });
});
