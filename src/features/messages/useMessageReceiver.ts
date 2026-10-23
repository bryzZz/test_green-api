import { useEffect, useEffectEvent, useState } from 'react';
import {
  createGreenApiClient,
  type Credentials,
} from '@/api/createGreenApiClient';
import type { ChatsStore } from '../chats/store/chatsStore';
import { runPolling } from './runPolling';

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
export const useMessageReceiver = ({
  credentials,
  store,
  onUnauthorized,
}: Options) => {
  const [connected, setConnected] = useState(true);
  // Always the latest callback, without restarting the loop for it.
  const handleUnauthorized = useEffectEvent(onUnauthorized);

  useEffect(() => {
    const controller = new AbortController();

    void runPolling({
      client: createGreenApiClient(credentials),
      onEvent: (event) => store.getState().applyEvent(event),
      onConnectionChange: setConnected,
      onUnauthorized: () => handleUnauthorized(),
      signal: controller.signal,
    });

    return () => controller.abort();
  }, [credentials, store]);

  return connected;
};
