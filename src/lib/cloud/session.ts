import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export interface SessionState {
  session: Session | null;
  /** True until the initial session is read from SecureStore. */
  loading: boolean;
}

/**
 * Subscribe to Supabase auth state. Used to gate the cloud-backup UI:
 * signed-out → show sign-in form; signed-in → show backups.
 * The invite-code gate in (auth) is separate — this only governs cloud sync.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .catch(() => {
        // Network / SecureStore failure — fall back to signed-out, never deadlock.
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/** Map Supabase auth errors to short, user-facing copy. */
function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('already registered')) return 'That email is already registered. Sign in instead.';
  if (m.includes('email not confirmed')) return 'Confirm your email, then sign in.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  // Never surface raw Supabase/PostgREST internals to the UI.
  return 'Authentication failed. Please try again.';
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(authMessage(error.message));
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(authMessage(error.message));
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
