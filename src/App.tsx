import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { authStore, useCredentials } from './features/auth/auth';
import { LoginScreen } from './features/auth/login-screen';

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const credentials = useCredentials();

  function logout() {
    // Forget the token first, so nothing mounted can refetch with it, then
    // drop whatever the cache still holds.
    authStore.getState().logout();
    queryClient.clear();
  }

  return (
    <QueryClientProvider client={queryClient}>
      {credentials ? (
        <main className="bg-wallpaper flex h-full flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-semibold">MAX Chat</h1>
          <button
            type="button"
            onClick={logout}
            className="rounded-md bg-bg px-4 py-2"
          >
            Выйти
          </button>
        </main>
      ) : (
        <LoginScreen
          onLoggedIn={(loggedIn) => authStore.getState().login(loggedIn)}
        />
      )}
    </QueryClientProvider>
  );
}
