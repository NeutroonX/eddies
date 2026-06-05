import { useStore } from '@/store';
import { getCurrencySymbol } from '@/lib/format';

export function useCurrencySymbol(): string {
  return getCurrencySymbol(useStore((s) => s.currency));
}
