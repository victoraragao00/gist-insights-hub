const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN");
if (!ALLOWED_ORIGIN) {
  console.error("[SECURITY] ALLOWED_ORIGIN env var not configured");
}
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN ?? "",
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GIST_BASE_URL = 'https://api.getgist.com';

const ALLOWED_ENDPOINTS = [
  'contacts',
  'conversations',
  'campaigns',
  'tags',
  'segments',
  'teammates',
  'token',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ALLOWED_ORIGIN) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: ALLOWED_ORIGIN not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }


  try {
    const apiKey = Deno.env.get('GIST_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!apiKey || !supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // JWT validation — identify the caller before forwarding to Gist API
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    const supaAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supaAuth.auth.getUser();
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { endpoint, params } = await req.json();

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Invalid endpoint. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize params — only allow string/number values to prevent injection
    const safeParams: Record<string, string> = {};
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (typeof v === 'string' || typeof v === 'number') {
          safeParams[String(k)] = String(v);
        }
      }
    }

    const queryString = Object.keys(safeParams).length > 0 ? '?' + new URLSearchParams(safeParams).toString() : '';
    const gistUrl = `${GIST_BASE_URL}/${endpoint}${queryString}`;

    const gistResponse = await fetch(gistUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await gistResponse.text();

    if (!gistResponse.ok) {
      let details: unknown = responseText;
      try { details = JSON.parse(responseText); } catch { /* keep as text */ }
      return new Response(
        JSON.stringify({ error: 'Gist API error', status: gistResponse.status, details }),
        { status: gistResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Gist returned invalid JSON', raw: responseText.substring(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
