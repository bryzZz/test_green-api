import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import type { MessageStatus } from '../store/types';

const marks = {
  pending: { Icon: Clock, label: 'Отправляется' },
  sent: { Icon: Check, label: 'Отправлено' },
  delivered: { Icon: CheckCheck, label: 'Доставлено' },
  read: { Icon: CheckCheck, label: 'Прочитано' },
  failed: { Icon: AlertCircle, label: 'Не отправлено' },
} as const;

type DeliveryMarkProps = {
  status: MessageStatus;
  className?: string;
};

/** Clock, one or two ticks, or an alert: how far an outgoing message got. */
export const DeliveryMark = ({ status, className = '' }: DeliveryMarkProps) => {
  const { Icon, label } = marks[status];
  const colorClass = status === 'failed' ? 'text-text-negative' : className;

  return (
    <Icon
      role="img"
      aria-label={label}
      className={`size-4 shrink-0 ${colorClass}`}
    />
  );
};
