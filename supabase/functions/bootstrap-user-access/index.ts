const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!serviceKey || !supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supaAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supaAuth.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // Check if user already has any access rows
    const { count, error: countError } = await supaAdmin
      .from('user_client_access')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw new Error('Failed to check access: ' + countError.message);

    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ bootstrapped: false, reason: 'already_has_access' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active clients
    const { data: clients, error: clientsError } = await supaAdmin
      .from('clients')
      .select('id')
      .eq('active', true);

    if (clientsError) throw new Error('Failed to fetch clients: ' + clientsError.message);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ bootstrapped: false, reason: 'no_active_clients' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert viewer access for all active clients
    const rows = clients.map((c: { id: string }) => ({
      user_id: userId,
      client_id: c.id,
      role: 'viewer',
    }));

    const { error: insertError } = await supaAdmin
      .from('user_client_access')
      .insert(rows);

    if (insertError) throw new Error('Failed to insert access: ' + insertError.message);

    console.log(`[bootstrap-user-access] Granted viewer access to ${clients.length} clients for user ${userId}`);

    return new Response(JSON.stringify({ bootstrapped: true, clients_granted: clients.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
