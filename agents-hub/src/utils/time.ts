export function now(): string {
  return new Date().toISOString();
}

export function isValidISO(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.toISOString() === value;
}
