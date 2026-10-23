import { formatPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['89991234567', '79991234567'],
    ['79991234567', '79991234567'],
    ['9991234567', '79991234567'],
  ])('turns %s into %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ['an empty string', ''],
    ['too few digits', '+7 (999) 123'],
    ['too many digits', '799912345678'],
    ['a foreign number', '+1 415 555 2671'],
    ['letters', 'abc'],
  ])('rejects %s', (_name, input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('formats normalized digits the way the app shows them', () => {
    expect(formatPhone('79991234567')).toBe('+7 (999) 123-45-67');
  });
});
