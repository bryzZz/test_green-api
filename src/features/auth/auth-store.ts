import { persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import type { Credentials } from '../../api/client';

type AuthState = {
  credentials: Credentials | null;
  login: (credentials: Credentials) => void;
  logout: () => void;
};

export function createAuthStore() {
  return createStore<AuthState>()(
    persist(
      (set) => ({
        credentials: null,
        login: (credentials) => set({ credentials }),
        logout: () => set({ credentials: null }),
      }),
      {
        name: 'max-chat:credentials',
        partialize: ({ credentials }) => ({ credentials }),
      },
    ),
  );
}

export type AuthStore = ReturnType<typeof createAuthStore>;
