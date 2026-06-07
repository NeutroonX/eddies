const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'INVALID_EMAIL' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const ownerEmail = Deno.env.get('OWNER_EMAIL');
    const fromEmail = Deno.env.get('FROM_EMAIL');
    if (!resendKey || !ownerEmail || !fromEmail) {
      console.error('RESEND_API_KEY secret is not set');
      return new Response(
        JSON.stringify({ error: 'SERVICE_UNAVAILABLE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 },
      );
    }

    const sanitised = email.trim().toLowerCase().replace(/[<>"']/g, '');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Eddies <${fromEmail}>`,
        to: [ownerEmail],
        subject: `Beta Access Request — ${sanitised}`,
        html: `
          <p>Someone wants access to <strong>Eddies</strong>.</p>
          <p><strong>Email:</strong> ${sanitised}</p>
          <hr />
          <p>Generate a code in Supabase and send it to them:</p>
          <pre>INSERT INTO invite_codes (code, max_uses) VALUES ('XXXX-YYYY-ZZZZ', 1);</pre>
        `,
        text: `Beta access request from: ${sanitised}\n\nGenerate a code in Supabase and send it to them.`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', res.status, body);
      return new Response(
        JSON.stringify({ error: 'SEND_FAILED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('request-access error:', err);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
