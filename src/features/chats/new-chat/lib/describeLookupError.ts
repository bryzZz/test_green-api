import { ApiError } from '@/api/ApiError';

/** The number has no account in MAX. */
export class NotRegisteredError extends Error {}

/** What to tell the user about a failed lookup of a phone number. */
export const describeLookupError = (error: unknown): string => {
  if (error instanceof NotRegisteredError) {
    return 'Номер не зарегистрирован в MAX.';
  }
  if (!(error instanceof ApiError)) {
    return 'Не удалось найти номер. Попробуйте ещё раз.';
  }

  switch (error.kind) {
    case 'network':
      return 'Нет соединения с сервером. Попробуйте ещё раз.';
    case 'rateLimited':
      return 'Слишком много запросов. Подождите немного и повторите.';
    case 'unauthorized':
      return 'Учётные данные больше не действуют. Войдите заново.';
    default:
      return 'Не удалось найти номер. Попробуйте ещё раз.';
  }
};
