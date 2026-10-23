const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const pad = (value: number) => String(value).padStart(2, '0');

/** The key of the calendar day a timestamp falls on, for grouping messages. */
export function dayKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toDateString();
}

/** `Сегодня`, `Вчера`, `20 октября`, `31 декабря 2025`. */
export function formatDayLabel(unixSeconds: number, now = new Date()): string {
  const date = new Date(unixSeconds * 1000);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';

  const label = `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear()
    ? label
    : `${label} ${date.getFullYear()}`;
}

/** `19:10` for today, `22 окт` for earlier this year, `31.12.2025` before. */
export function formatChatTime(unixSeconds: number, now = new Date()): string {
  const date = new Date(unixSeconds * 1000);

  if (date.toDateString() === now.toDateString()) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}
