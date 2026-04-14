const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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
      if (body.skip_inactivation) payload.skip_inactivation = true;
    } catch { /* no body */ }

    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // Incremental: get last completed sync timestamp
    const { data: lastJob } = await supaAdmin
      .from('sync_jobs')
      .select('completed_at')
      .eq('type', 'sync_contacts')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (lastJob?.completed_at) {
      payload.since_timestamp = lastJob.completed_at;
    }

    // Atomic: create job only if none active (FOR UPDATE SKIP LOCKED)
    const { data: result, error: rpcErr } = await supaAdmin.rpc('create_job_if_none_active', {
      _type: 'sync_contacts',
      _created_by: callerUserId,
      _payload: payload,
    });

    if (rpcErr) throw new Error('Failed to create job: ' + rpcErr.message);

    const row = Array.isArray(result) ? result[0] : result;
    const jobId = row.job_id;
    const alreadyRunning = row.already_running;

    console.log(`[sync-gist-contacts] ${alreadyRunning ? 'Reused existing' : 'Created'} job ${jobId} for user ${callerUserId}`);

    // Fire-and-forget: trigger process-jobs immediately
    if (!alreadyRunning) {
      fetch(`${supabaseUrl}/functions/v1/process-jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }).catch(() => { /* fire and forget */ });
      console.log('[sync-gist-contacts] Triggered process-jobs');
    }

    return new Response(JSON.stringify({ success: true, job_id: jobId, already_running: alreadyRunning }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
