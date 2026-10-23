import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { authStore, useCredentials } from './features/auth/auth';
import { LoginScreen } from './features/auth/login-screen';
import { MainScreen } from './features/chats/main-screen';

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
        <MainScreen
          key={credentials.idInstance}
          credentials={credentials}
          onLogout={logout}
        />
      ) : (
        <LoginScreen
          onLoggedIn={(loggedIn) => authStore.getState().login(loggedIn)}
        />
      )}
    </QueryClientProvider>
  );
}
