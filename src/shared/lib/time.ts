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

const pad = (value: number) => String(value).padStart(2, '0');

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
