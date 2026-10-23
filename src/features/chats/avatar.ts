// Placeholder-avatar gradients, taken from the CSS variables of web.max.ru.
const GRADIENTS = [
  { from: '#1bd6e3', to: '#27a5c8' }, // malachite
  { from: '#79bcff', to: '#4289ed' }, // dark sky
  { from: '#9b90fe', to: '#6746ec' }, // lilac
  { from: '#fa82ba', to: '#e74aa6' }, // orchid
  { from: '#ffb381', to: '#e5782d' }, // tangerine
  { from: '#ff48b6', to: '#ff8a35' }, // coral
  { from: '#14e1d5', to: '#03c722' }, // green
] as const;

/** A stable color per chat, so a chat keeps its look between sessions. */
export function avatarGradient(chatId: string) {
  let hash = 0;
  for (const char of chatId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/** Up to two capital letters from the first two words; '' if there are none. */
export function getInitials(name?: string): string {
  const words = (name ?? '').split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0].toUpperCase())
    .join('');
}
