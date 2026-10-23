import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';
import type { MessageStatus } from './chats-store';

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
export function DeliveryMark({ status, className = '' }: DeliveryMarkProps) {
  const { Icon, label } = marks[status];

  return (
    <Icon
      role="img"
      aria-label={label}
      className={`size-4 shrink-0 ${status === 'failed' ? 'text-text-negative' : className}`}
    />
  );
}
