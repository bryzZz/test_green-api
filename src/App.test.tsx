import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { authStore } from './features/auth/auth';
import { createFakeGreenApi } from './mocks/fake-green-api';
import { server } from './test/server';

const credentials = {
  apiUrl: 'https://api.green-api.com',
  idInstance: '1101000001',
  apiTokenInstance: 'secret-token',
};

beforeEach(() => {
  authStore.setState({ credentials: null });
  server.use(...createFakeGreenApi().handlers);
});

describe('App', () => {
  it('asks to log in when there are no saved credentials', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Вход в GREEN-API' }),
    ).toBeInTheDocument();
  });

  it('opens the chat after a successful login', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText('idInstance'), '1101000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(
      await screen.findByRole('button', { name: 'Выйти' }),
    ).toBeInTheDocument();
    expect(authStore.getState().credentials).toEqual(credentials);
  });

  it('goes straight to the chat when credentials were saved', () => {
    authStore.getState().login(credentials);

    render(<App />);

    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  });

  it('returns to the login screen and forgets the credentials on logout', async () => {
    authStore.getState().login(credentials);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(
      screen.getByRole('heading', { name: 'Вход в GREEN-API' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('max-chat:credentials')).not.toContain(
      'secret-token',
    );
  });
});
