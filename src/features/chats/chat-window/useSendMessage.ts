import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api/ApiError';
import {
  createGreenApiClient,
  type Credentials,
} from '@/api/createGreenApiClient';
import type { ChatsStore } from '../store/chatsStore';

type Options = {
  credentials: Credentials;
  store: ChatsStore;
  chatId: string;
};

/**
 * Sends a text to the chat. The message shows up in the store at once as
 * pending, then becomes sent or failed. The callbacks are options of the
 * mutation itself, so a message still leaves "pending" when the user moves
 * to another chat meanwhile.
 */
export const useSendMessage = ({ credentials, store, chatId }: Options) =>
  useMutation({
    onMutate: (text: string) => store.getState().startSending(chatId, text),
    mutationFn: (text: string) =>
      createGreenApiClient(credentials).sendMessage({ chatId, message: text }),
    onSuccess: ({ idMessage }, _text, localId) => {
      if (!localId) return;
      store.getState().confirmSent(chatId, localId, idMessage);
    },
    onError: (error, _text, localId) => {
      if (!localId) return;
      const kind = error instanceof ApiError ? error.kind : 'server';
      store.getState().failSent(chatId, localId, kind);
    },
  });
