import { QueryClient } from '@tanstack/react-query';

// Single app-wide client for cloud server-state (Supabase backups).
// Device/UI state stays in Zustand; durable key/value in MMKV.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Backups change rarely; avoid hammering a free-tier project.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
