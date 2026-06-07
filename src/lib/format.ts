export function formatMinor(minor: number, decimals: number = 2): string {
  const major = minor / 100;
  return major.toFixed(decimals);
}

export { getCurrencySymbol } from '@/constants/currencies';
