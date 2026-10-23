import { ApiError } from '@/api/ApiError';

/** The instance answered, but it is not signed in to MAX. */
export class NotAuthorizedError extends Error {}

/** What to tell the user about a failed login attempt. */
export const describeLoginError = (error: unknown): string => {
  if (error instanceof NotAuthorizedError) {
    return 'Инстанс не авторизован. Отсканируйте QR-код в личном кабинете GREEN-API и повторите.';
  }
  if (!(error instanceof ApiError)) {
    return 'Не удалось войти. Попробуйте ещё раз.';
  }

  switch (error.kind) {
    case 'unauthorized':
      return 'Неверный idInstance или apiTokenInstance.';
    case 'network':
      return 'Нет соединения с сервером. Проверьте интернет и адрес API.';
    case 'rateLimited':
      return 'Слишком много запросов. Подождите немного и повторите.';
    default:
      return 'Не удалось войти. Попробуйте ещё раз.';
  }
};
