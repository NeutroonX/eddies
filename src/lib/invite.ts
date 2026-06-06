import { z } from 'zod';
import { supabase } from './supabase';

const ResponseSchema = z.discriminatedUnion('granted', [
  z.object({ granted: z.literal(true) }),
  z.object({ granted: z.literal(false), error: z.string() }),
]);

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE:   'INVALID CODE — CHECK FOR TYPOS',
  EXPIRED_CODE:   'THIS CODE HAS EXPIRED',
  CODE_EXHAUSTED: 'THIS CODE IS ALREADY USED',
};

export async function validateInviteCode(
  code: string,
): Promise<{ granted: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-invite-code', {
      body: { code: code.trim().toUpperCase() },
    });
    if (error) return { granted: false, error: 'CONNECTION ERROR — TRY AGAIN' };

    const parsed = ResponseSchema.safeParse(data);
    if (!parsed.success) return { granted: false, error: 'UNEXPECTED RESPONSE' };

    if (parsed.data.granted) return { granted: true, error: null };
    return {
      granted: false,
      error: ERROR_MESSAGES[parsed.data.error] ?? 'CODE NOT ACCEPTED',
    };
  } catch {
    return { granted: false, error: 'CONNECTION ERROR — TRY AGAIN' };
  }
}
