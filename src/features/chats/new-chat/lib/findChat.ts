import {
  createGreenApiClient,
  type Credentials,
} from '@/api/createGreenApiClient';
import { NotRegisteredError } from './describeLookupError';

type FoundChat = { phone: string; chatId: string };

/**
 * The chat id for a phone number: the remembered one if there is one, else
 * what GREEN-API says. Throws `NotRegisteredError` for a number without MAX.
 */
export const findChat = async (
  credentials: Credentials,
  knownChatId: (phone: string) => string | undefined,
  phone: string,
): Promise<FoundChat> => {
  const cached = knownChatId(phone);
  if (cached) return { phone, chatId: cached };

  const result = await createGreenApiClient(credentials).checkAccount(
    Number(phone),
  );
  if (!result.exist || !result.chatId) throw new NotRegisteredError();
  return { phone, chatId: result.chatId };
};
