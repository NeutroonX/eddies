const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ granted: false, error: 'INVALID_CODE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const normalised = code.trim().toUpperCase();
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = {
      'Authorization': `Bearer ${key}`,
      'apikey': key,
      'Content-Type': 'application/json',
    };

    // Fetch the code row
    const selectRes = await fetch(
      `${url}/rest/v1/invite_codes?code=eq.${encodeURIComponent(normalised)}&limit=1`,
      { headers },
    );
    const rows: Record<string, unknown>[] = await selectRes.json();
    const data = rows[0] ?? null;

    if (!data) {
      return new Response(
        JSON.stringify({ granted: false, error: 'INVALID_CODE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!data.is_active) {
      return new Response(
        JSON.stringify({ granted: false, error: 'INVALID_CODE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
      return new Response(
        JSON.stringify({ granted: false, error: 'EXPIRED_CODE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const usesCount = data.uses_count as number;
    const maxUses = data.max_uses as number | null;

    if (maxUses !== null && usesCount >= maxUses) {
      return new Response(
        JSON.stringify({ granted: false, error: 'CODE_EXHAUSTED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const newUsesCount = usesCount + 1;
    const shouldDeactivate = maxUses !== null && newUsesCount >= maxUses;

    // Atomic conditional update: filter includes uses_count=eq.{usesCount} so a concurrent
    // request that already incremented it will cause this PATCH to match 0 rows.
    const patchRes = await fetch(
      `${url}/rest/v1/invite_codes?id=eq.${data.id}&uses_count=eq.${usesCount}&is_active=eq.true`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          uses_count: newUsesCount,
          ...(shouldDeactivate ? { is_active: false } : {}),
        }),
      },
    );
    const updated: Record<string, unknown>[] = await patchRes.json();

    if (updated.length === 0) {
      // Another concurrent request won the race — code was already used or exhausted.
      return new Response(
        JSON.stringify({ granted: false, error: 'CODE_EXHAUSTED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ granted: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('validate-invite-code error:', err);
    return new Response(
      JSON.stringify({ granted: false, error: 'INTERNAL_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
