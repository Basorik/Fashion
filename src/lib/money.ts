// Reads a price typed or scraped in any common format: "49.99", "49,99",
// "1,299.00", "1.299,00", "$ 1 299". Returns null for anything that isn't a
// positive-or-zero number.
export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  let text = String(value).replace(/[^0-9.,]/g, '');
  if (!/\d/.test(text)) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  // A comma followed by one or two digits at the end is a decimal comma.
  const decimalComma = lastComma > lastDot && /,\d{1,2}$/.test(text);
  text = decimalComma ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  // Several dots are thousands separators ("1.299.000").
  if ((text.match(/\./g) ?? []).length > 1) text = text.replace(/\./g, '');
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// A price in the phone's number format, with cents only when there are any.
export function formatPrice(value: number) {
  const whole = Number.isInteger(value);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
