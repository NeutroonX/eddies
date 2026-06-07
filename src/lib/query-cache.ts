const store = new Map<string, { data: unknown; ts: number }>();

export function clearCache(): void { store.clear(); }
