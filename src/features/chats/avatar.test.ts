import { avatarGradient, getInitials } from './avatar';

describe('getInitials', () => {
  it.each([
    ['Ivan Petrov', 'IP'],
    ['ivan petrov', 'IP'],
    ['Ivan', 'I'],
    ['Иван Иванович Петров', 'ИИ'],
    ['  Ivan   Petrov  ', 'IP'],
    ['𝓐lex 𝓑', '𝓐𝓑'],
  ])('turns %s into %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  it.each([
    ['nothing', undefined],
    ['an empty name', ''],
    ['a phone number', '+7 (999) 123-45-67'],
  ])('has no initials for %s', (_name, name) => {
    expect(getInitials(name)).toBe('');
  });
});

describe('avatarGradient', () => {
  it('always gives the same colors to the same chat', () => {
    expect(avatarGradient('10000001')).toEqual(avatarGradient('10000001'));
  });

  it('spreads neighbouring chat ids over different colors', () => {
    const ids = Array.from({ length: 7 }, (_, i) => String(10000001 + i));

    const colors = new Set(ids.map((id) => avatarGradient(id).from));

    expect(colors.size).toBe(7);
  });
});
