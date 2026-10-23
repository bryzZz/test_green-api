/**
 * Reduces a Russian phone number typed in any common way to its 11 digits
 * starting with 7, or returns null if it is not one.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return `7${digits.slice(1)}`;
  }
  return null;
}

/** `79991234567` → `+7 (999) 123-45-67`. */
export function formatPhone(digits: string): string {
  const [, a, b, c, d] = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits) ?? [];
  return a ? `+7 (${a}) ${b}-${c}-${d}` : digits;
}
