const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

  try {
    const apiKey = Deno.env.get('GIST_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GIST_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { endpoint, params } = await req.json();

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Invalid endpoint. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
