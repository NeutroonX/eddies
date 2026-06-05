// All money is stored as integer minor units (cents). No floats in storage.

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

export function formatAmount(minorUnits: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(minorUnits));
}

// Tabular format with aligned decimal — for ledger rows.
export function formatAmountTabular(minorUnits: number): string {
  const n = fromMinorUnits(Math.abs(minorUnits));
  const [int, dec] = n.toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}.${dec}`;
}

export function addMinorUnits(a: number, b: number): number {
  return a + b;
}

export function subtractMinorUnits(a: number, b: number): number {
  return a - b;
}

export function isPositive(minorUnits: number): boolean {
  return minorUnits > 0;
}
