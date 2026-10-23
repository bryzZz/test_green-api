import type { ApiErrorKind } from '@/api/ApiError';
import type { Message } from '../../../store/types';

const REASONS: Record<ApiErrorKind, string> = {
  quota: 'Не отправлено: достигнут лимит тарифа на новые чаты.',
  network: 'Не отправлено: нет соединения с сервером.',
  unauthorized: 'Не отправлено: учётные данные больше не действуют.',
  rateLimited: 'Не отправлено: слишком много запросов, подождите немного.',
  badRequest: 'Не отправлено: что-то пошло не так.',
  server: 'Не отправлено: что-то пошло не так.',
};

/** Why a message was not sent, in words for the user. */
export const failureReason = (message: Message): string => {
  if (!message.errorKind) return 'Не удалось отправить сообщение.';
  return REASONS[message.errorKind];
};
