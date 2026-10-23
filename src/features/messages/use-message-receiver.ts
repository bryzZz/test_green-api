import { useEffect, useRef, useState } from 'react';
import { createGreenApiClient, type Credentials } from '../../api/client';
import type { ChatsStore } from '../chats/chats-store';
import { runPolling } from './polling';

type Options = {
  credentials: Credentials;
  store: ChatsStore;
  /** The credentials were rejected while receiving; polling has stopped. */
  onUnauthorized: () => void;
};

/**
 * Feeds the chats store with what arrives from GREEN-API for as long as the
 * component is mounted. Returns whether the connection currently works.
 */
export function useMessageReceiver({
  credentials,
  store,
  onUnauthorized,
}: Options) {
  const [connected, setConnected] = useState(true);

  // Always call the latest callback without restarting the loop for it.
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  });

  useEffect(() => {
    const controller = new AbortController();
    void runPolling({
      client: createGreenApiClient(credentials),
      onEvent: (event) => store.getState().applyEvent(event),
      onConnectionChange: setConnected,
      onUnauthorized: () => onUnauthorizedRef.current(),
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [credentials, store]);

  return connected;
}
