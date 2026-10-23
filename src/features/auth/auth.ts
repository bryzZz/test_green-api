import { useStore } from 'zustand';
import { createAuthStore } from './auth-store';

export const authStore = createAuthStore();

export function useCredentials() {
  return useStore(authStore, (state) => state.credentials);
}
