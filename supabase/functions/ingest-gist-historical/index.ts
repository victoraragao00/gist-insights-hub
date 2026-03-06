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

    const callerUserId = authData.user.id;

    // Parse body for payload params
    let payload: Record<string, unknown> = {};
    try {
      const body = await req.json();
      if (body.delete_client_id) payload.delete_client_id = body.delete_client_id;
    } catch { /* no body */ }

    // Create job
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // Incremental: get last completed ingest timestamp
    const { data: lastJob } = await supaAdmin
      .from('sync_jobs')
      .select('completed_at')
      .eq('type', 'ingest_historical')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (lastJob?.completed_at) {
      payload.since_timestamp = lastJob.completed_at;
    }
    const { data: job, error: jobErr } = await supaAdmin
      .from('sync_jobs')
      .insert({
        type: 'ingest_historical',
        status: 'pending',
        created_by: callerUserId,
        payload,
        progress: {},
      })
      .select('id')
      .single();

    if (jobErr) throw new Error('Failed to create job: ' + jobErr.message);

    console.log(`[ingest-gist-historical] Created job ${job.id} for user ${callerUserId}`);

    return new Response(JSON.stringify({ success: true, job_id: job.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
