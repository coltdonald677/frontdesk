export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatCurrencyInput(value: number): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

export function formatQuantityInput(value: number): string {
  if (!Number.isFinite(value)) return "1";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function parseQuantityInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
