import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('invite_codes')
      .select('id, is_active, expires_at, uses_count, max_uses')
      .eq('code', normalised)
      .single();

    if (error || !data) {
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

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ granted: false, error: 'EXPIRED_CODE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (data.max_uses !== null && data.uses_count >= data.max_uses) {
      return new Response(
        JSON.stringify({ granted: false, error: 'CODE_EXHAUSTED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const newUsesCount = data.uses_count + 1;
    const shouldDeactivate = data.max_uses !== null && newUsesCount >= data.max_uses;

    await supabase
      .from('invite_codes')
      .update({
        uses_count: newUsesCount,
        ...(shouldDeactivate ? { is_active: false } : {}),
      })
      .eq('id', data.id);

    return new Response(
      JSON.stringify({ granted: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({ granted: false, error: 'INTERNAL_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
