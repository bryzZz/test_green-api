import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from './Composer';

const renderComposer = () => {
  const onSend = vi.fn();
  render(<Composer onSend={onSend} />);
  return { onSend, user: userEvent.setup() };
};

const field = () => screen.getByRole('textbox', { name: 'Сообщение' });

describe('Composer focus', () => {
  const stubWideScreen = (matches: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  afterEach(() => vi.unstubAllGlobals());

  it('is focused when the screen is wide, so the user can type right away', () => {
    stubWideScreen(true);
    renderComposer();

    expect(field()).toHaveFocus();
  });

  it('is not focused on a phone, where it would pop the keyboard open', () => {
    stubWideScreen(false);
    renderComposer();

    expect(field()).not.toHaveFocus();
  });
});

describe('Composer', () => {
  it('sends the text on Enter, clears the field and keeps the focus there', async () => {
    const { onSend, user } = renderComposer();

    await user.type(field(), 'Привет{Enter}');

    expect(onSend).toHaveBeenCalledExactlyOnceWith('Привет');
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
  });

  it('starts a new line on Shift+Enter instead of sending', async () => {
    const { onSend, user } = renderComposer();

    await user.type(field(), 'первая{Shift>}{Enter}{/Shift}вторая');

    expect(onSend).not.toHaveBeenCalled();
    expect(field()).toHaveValue('первая\nвторая');

    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledExactlyOnceWith('первая\nвторая');
  });

  it('trims the text it sends', async () => {
    const { onSend, user } = renderComposer();

    await user.type(field(), '  привет  {Enter}');

    expect(onSend).toHaveBeenCalledWith('привет');
  });

  it.each([
    ['nothing', ''],
    ['spaces only', '   '],
    ['line breaks only', '{Shift>}{Enter}{Enter}{/Shift}'],
  ])('does not send %s', async (_name, typed) => {
    const { onSend, user } = renderComposer();

    await user.type(field(), `${typed}{Enter}`);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows the send button only once there is something to send', async () => {
    const { onSend, user } = renderComposer();
    expect(
      screen.queryByRole('button', { name: 'Отправить сообщение' }),
    ).not.toBeInTheDocument();

    await user.type(field(), '   ');
    expect(
      screen.queryByRole('button', { name: 'Отправить сообщение' }),
    ).not.toBeInTheDocument();

    await user.type(field(), 'Привет');
    await user.click(
      screen.getByRole('button', { name: 'Отправить сообщение' }),
    );

    expect(onSend).toHaveBeenCalledExactlyOnceWith('Привет');
    expect(field()).toHaveValue('');
  });

  it('does not take more than 4000 characters', async () => {
    const { user } = renderComposer();

    await user.click(field());
    await user.paste('a'.repeat(4100));

    expect(field()).toHaveValue('a'.repeat(4000));
  });
});
