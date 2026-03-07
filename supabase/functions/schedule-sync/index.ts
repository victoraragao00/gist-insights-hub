const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // 1. Check if auto_sync_enabled
    const { data: setting, error: settingErr } = await supaAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'auto_sync_enabled')
      .single();

    if (settingErr || !setting) {
      console.log('[schedule-sync] Could not read auto_sync_enabled, skipping');
      return new Response(JSON.stringify({ skipped: true, reason: 'setting_not_found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (setting.value === false || setting.value === 'false') {
      console.log('[schedule-sync] Auto-sync disabled, skipping');
      return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, unknown> = {};

    // 2. Create jobs for each type
    const jobTypes = ['sync_contacts', 'ingest_historical'] as const;

    for (const jobType of jobTypes) {
      // Get since_timestamp from last completed job of this type
      const { data: lastJob } = await supaAdmin
        .from('sync_jobs')
        .select('completed_at')
        .eq('type', jobType)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      const payload: Record<string, unknown> = {};
      if (lastJob?.completed_at) {
        payload.since_timestamp = lastJob.completed_at;
      }

      const { data: result, error: rpcErr } = await supaAdmin.rpc('create_job_if_none_active', {
        _type: jobType,
        _created_by: null,
        _payload: payload,
      });

      if (rpcErr) {
        console.error(`[schedule-sync] Error creating ${jobType} job:`, rpcErr.message);
        results[jobType] = { error: rpcErr.message };
        continue;
      }

      const row = Array.isArray(result) ? result[0] : result;
      results[jobType] = { job_id: row.job_id, already_running: row.already_running };
      console.log(`[schedule-sync] ${jobType}: ${row.already_running ? 'already active' : 'created'} job ${row.job_id}`);
    }

    // 3. Fire-and-forget: trigger process-jobs to start immediately
    const hasNewJob = Object.values(results).some(
      (r: any) => r?.job_id && !r?.already_running
    );

    if (hasNewJob) {
      try {
        fetch(`${supabaseUrl}/functions/v1/process-jobs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }).catch(() => { /* fire and forget */ });
        console.log('[schedule-sync] Triggered process-jobs');
      } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[schedule-sync] Error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
