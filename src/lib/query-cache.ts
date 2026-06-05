type Entry = { data: unknown; ts: number };
const store = new Map<string, Entry>();

export function getCached<T>(key: string, ttlMs: number): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > ttlMs) { store.delete(key); return null; }
  return e.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidatePrefix(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export function clearCache(): void { store.clear(); }
