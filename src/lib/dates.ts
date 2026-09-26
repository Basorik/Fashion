// Dates are stored as local YYYY-MM-DD strings so they match the user's calendar.
export function toDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDateString(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Reads a typed YYYY-MM-DD date (single-digit month and day allowed). Returns
// null for anything else, impossible dates like 2025-02-30, and future dates.
export function parseDateString(value: string) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const result = toDateString(date);
  return result > toDateString(new Date()) ? null : result;
}

export function addDays(value: string, days: number) {
  const date = fromDateString(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function daysBetween(from: string, to: string) {
  return Math.round((fromDateString(to).getTime() - fromDateString(from).getTime()) / 86_400_000);
}

export function formatDay(value: string) {
  return fromDateString(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// "12 Mar 2025", for dates that may be in another year.
export function formatDate(value: string) {
  return fromDateString(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// "today", "yesterday", "3 days ago", then "12 Sep" (with the year if it isn't this year).
export function formatShortDay(value: string, today: string) {
  const days = daysBetween(value, today);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  const date = fromDateString(value);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === fromDateString(today).getFullYear() ? {} : { year: 'numeric' }),
  });
}

export function formatMonth(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// "Today", "Yesterday", "3 days ago", or a date for anything older than a week.
export function formatRelativeDay(value: string, today: string) {
  const days = daysBetween(value, today);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDay(value);
}
