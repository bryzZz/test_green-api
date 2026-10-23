import { persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import type { Credentials } from '@/api/createGreenApiClient';

type AuthState = {
  credentials: Credentials | null;
  login: (credentials: Credentials) => void;
  logout: () => void;
};

/** The GREEN-API credentials of the user, kept in localStorage. */
export const createAuthStore = () =>
  createStore<AuthState>()(
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

/** The one store of the app. */
export const authStore = createAuthStore();
