/**
 * Reduces a Russian phone number typed in any common way to its 11 digits
 * starting with 7, or returns null if it is not one.
 */
export const normalizePhone = (input: string): string | null => {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 10) return `7${digits}`;
  if (digits.length !== 11) return null;
  if (digits[0] !== '7' && digits[0] !== '8') return null;
  return `7${digits.slice(1)}`;
};

/** `79991234567` → `+7 (999) 123-45-67`. */
export const formatPhone = (digits: string): string => {
  const [, a, b, c, d] = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits) ?? [];
  if (!a) return digits;
  return `+7 (${a}) ${b}-${c}-${d}`;
};
