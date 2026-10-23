import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { Credentials } from '@/api/createGreenApiClient';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { authStore } from '@/features/auth/store/authStore';
import { useCredentials } from '@/features/auth/store/useCredentials';
import { MainScreen } from '@/features/chats/MainScreen';

const App = () => {
  const [queryClient] = useState(() => new QueryClient());
  const credentials = useCredentials();
  // Why the login screen is shown again, if it was not the user's choice.
  const [notice, setNotice] = useState<string>();

  // Forget the token first, so nothing mounted can refetch with it, then drop
  // whatever the cache still holds.
  const endSession = () => {
    authStore.getState().logout();
    queryClient.clear();
  };

  const handleLoggedIn = (loggedIn: Credentials) => {
    authStore.getState().login(loggedIn);
  };

  const handleLogout = () => {
    setNotice(undefined);
    endSession();
  };

  const handleSessionExpired = () => {
    // A loop that outlived its session must not end the new one.
    if (authStore.getState().credentials !== credentials) return;
    setNotice('Учётные данные больше не действуют. Войдите заново.');
    endSession();
  };

  return (
    <QueryClientProvider client={queryClient}>
      {credentials ? (
        <MainScreen
          key={credentials.idInstance}
          credentials={credentials}
          onLogout={handleLogout}
          onSessionExpired={handleSessionExpired}
        />
      ) : (
        <LoginScreen notice={notice} onLoggedIn={handleLoggedIn} />
      )}
    </QueryClientProvider>
  );
};

export default App;
