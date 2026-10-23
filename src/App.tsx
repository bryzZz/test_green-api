import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { authStore, useCredentials } from './features/auth/auth';
import { LoginScreen } from './features/auth/login-screen';
import { MainScreen } from './features/chats/main-screen';

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const credentials = useCredentials();
  // Why the login screen is shown again, if it was not the user's choice.
  const [notice, setNotice] = useState<string>();

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
          onLogout={() => {
            setNotice(undefined);
            logout();
          }}
          onSessionExpired={() => {
            // A loop that outlived its session must not end the new one.
            if (authStore.getState().credentials !== credentials) return;
            setNotice('Учётные данные больше не действуют. Войдите заново.');
            logout();
          }}
        />
      ) : (
        <LoginScreen
          notice={notice}
          onLoggedIn={(loggedIn) => authStore.getState().login(loggedIn)}
        />
      )}
    </QueryClientProvider>
  );
}
