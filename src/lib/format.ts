export function formatMinor(minor: number, decimals: number = 2): string {
  const major = minor / 100;
  return major.toFixed(decimals);
}

export { getCurrencySymbol } from '@/constants/currencies';
import { getCurrencySymbol } from '@/constants/currencies';

export function formatCurrency(minor: number, currency: string = 'USD', decimals: number = 2): string {
  return `${getCurrencySymbol(currency)}${(minor / 100).toFixed(decimals)}`;
}

export function formatPercentage(percentage: number, decimals: number = 1): string {
  return `${percentage.toFixed(decimals)}%`;
}
