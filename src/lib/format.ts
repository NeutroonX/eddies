export function formatMinor(minor: number, decimals: number = 2): string {
  const major = minor / 100;
  return major.toFixed(decimals);
}

export function formatCurrency(minor: number, currency: string = 'USD', decimals: number = 2): string {
  const major = minor / 100;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${major.toFixed(decimals)}`;
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    INR: '₹',
  };
  return symbols[currency] ?? currency;
}

export function formatPercentage(percentage: number, decimals: number = 1): string {
  return `${percentage.toFixed(decimals)}%`;
}
