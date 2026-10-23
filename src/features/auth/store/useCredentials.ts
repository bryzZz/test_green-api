import { useStore } from 'zustand';
import { authStore } from './authStore';

/** The credentials of the logged-in user, `null` while logged out. */
export const useCredentials = () =>
  useStore(authStore, (state) => state.credentials);
