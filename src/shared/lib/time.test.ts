import { formatChatTime } from './time';

// Dates are built from local parts, so the tests don't depend on the timezone.
const seconds = (...parts: [number, number, number, number?, number?]) =>
  new Date(...parts).getTime() / 1000;

const now = new Date(2026, 9, 23, 20, 0); // 23 Oct 2026, 20:00

describe('formatChatTime', () => {
  it('shows only the clock for today', () => {
    expect(formatChatTime(seconds(2026, 9, 23, 19, 10), now)).toBe('19:10');
    expect(formatChatTime(seconds(2026, 9, 23, 7, 5), now)).toBe('07:05');
  });

  it('shows the day and month for an earlier day this year', () => {
    expect(formatChatTime(seconds(2026, 9, 22, 23, 59), now)).toBe('22 окт');
    expect(formatChatTime(seconds(2026, 0, 5, 12, 0), now)).toBe('5 янв');
  });

  it('adds the year for another year', () => {
    expect(formatChatTime(seconds(2025, 11, 31, 12, 0), now)).toBe(
      '31.12.2025',
    );
  });
});
