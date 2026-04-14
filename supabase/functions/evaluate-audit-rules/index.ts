import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateRule, checkCooldown, formatAlertMessage, type AuditRule, type Operator } from './logic.ts';

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = Number(Deno.env.get('AUDIT_BATCH_SIZE') || '20');

// ── I/O Functions ──

async function fetchActiveRules(
  supaAdmin: ReturnType<typeof createClient>,
  offset: number,
  batchSize: number
): Promise<{ rules: AuditRule[]; hasMore: boolean }> {
  const { data, error } = await supaAdmin
    .from('audit_rules')
    .select('id, name, metric, operator, threshold, window_hours, cooldown_hours, client_id, active')
    .eq('active', true)
    .order('id')
    .range(offset, offset + batchSize - 1);

  if (error) throw new Error(`fetchActiveRules failed: ${error.message}`);

  const rules = (data || []) as AuditRule[];
  return { rules, hasMore: rules.length === batchSize };
}

async function getLastAlertForRule(
  supaAdmin: ReturnType<typeof createClient>,
  ruleId: string
): Promise<string | null> {
  const { data, error } = await supaAdmin
    .from('audit_alerts')
    .select('created_at')
    .eq('rule_id', ruleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.created_at;
}

async function calculateMetric(
  supaAdmin: ReturnType<typeof createClient>,
  rule: AuditRule
): Promise<number> {
  const windowHours = rule.window_hours || 24;
  const since = new Date();
  since.setHours(since.getHours() - windowHours);

  switch (rule.metric) {
    case 'score_prioridade': {
      if (!rule.client_id) return 0;
      const { data, error } = await supaAdmin
        .from('priority_scores')
        .select('score')
        .eq('client_id', rule.client_id)
        .single();
      if (error || !data) return 0;
      return data.score || 0;
    }

    case 'tom_critico_pct': {
      const query = supaAdmin
        .from('interactions')
        .select('id, tone', { count: 'exact' })
        .not('classified_at', 'is', null)
        .gte('occurred_at', since.toISOString());

      if (rule.client_id) {
        query.eq('client_id', rule.client_id);
      }

      const { count: totalCount, error: totalError } = await query;
      if (totalError || !totalCount || totalCount === 0) return 0;

      const criticoQuery = supaAdmin
        .from('interactions')
        .select('id', { count: 'exact' })
        .not('classified_at', 'is', null)
        .eq('tone', 'critico')
        .gte('occurred_at', since.toISOString());

      if (rule.client_id) {
        criticoQuery.eq('client_id', rule.client_id);
      }

      const { count: criticoCount, error: criticoError } = await criticoQuery;
      if (criticoError) return 0;

      return ((criticoCount || 0) / totalCount) * 100;
    }

    case 'tom_alerta_pct': {
      const query = supaAdmin
        .from('interactions')
        .select('id, tone', { count: 'exact' })
        .not('classified_at', 'is', null)
        .gte('occurred_at', since.toISOString());

      if (rule.client_id) {
        query.eq('client_id', rule.client_id);
      }

      const { count: totalCount, error: totalError } = await query;
      if (totalError || !totalCount || totalCount === 0) return 0;

      const alertaQuery = supaAdmin
        .from('interactions')
        .select('id', { count: 'exact' })
        .not('classified_at', 'is', null)
        .eq('tone', 'alerta')
        .gte('occurred_at', since.toISOString());

      if (rule.client_id) {
        alertaQuery.eq('client_id', rule.client_id);
      }

      const { count: alertaCount, error: alertaError } = await alertaQuery;
      if (alertaError) return 0;

      return ((alertaCount || 0) / totalCount) * 100;
    }

    case 'volume_periodo': {
      const query = supaAdmin
        .from('interactions')
        .select('id', { count: 'exact' })
        .not('classified_at', 'is', null)
        .gte('occurred_at', since.toISOString());

      if (rule.client_id) {
        query.eq('client_id', rule.client_id);
      }

      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    }

    default:
      console.log(`[evaluate-audit] Unknown metric: ${rule.metric}`);
      return 0;
  }
}

async function insertAlert(
  supaAdmin: ReturnType<typeof createClient>,
  rule: AuditRule,
  metricValue: number
): Promise<void> {
  const message = formatAlertMessage(
    rule.name,
    rule.metric,
    rule.operator as Operator,
    rule.threshold,
    metricValue
  );

  const { error } = await supaAdmin
    .from('audit_alerts')
    .insert({
      rule_id: rule.id,
      client_id: rule.client_id,
      metric_value: metricValue,
      threshold: rule.threshold,
      message,
      delivery_status: 'pending',
    });

  if (error) {
    // Ignore duplicate — cooldown should prevent, but be defensive against race conditions
    if (error.code === '23505') {
      console.log(`[evaluate-audit] rule=${rule.id} duplicate alert ignored (race condition)`);
      return;
    }
    throw new Error(`insertAlert failed: ${error.message}`);
  }
}

function handleAutoChain(selfUrl: string, serviceRoleKey: string, nextOffset: number): void {
  fetch(selfUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ _offset: nextOffset }),
  }).catch(() => {}); // fire-and-forget
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth: only service_role_key allowed (automated trigger)
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized — service role required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supaAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { _offset } = body as { _offset?: number };
    const offset = _offset || 0;

    const { rules, hasMore } = await fetchActiveRules(supaAdmin, offset, BATCH_SIZE);

    let evaluated = 0;
    let alertsCreated = 0;

    for (const rule of rules) {
      evaluated++;

      // Calculate metric
      const metricValue = await calculateMetric(supaAdmin, rule);

      // Evaluate rule
      const triggered = evaluateRule(metricValue, rule.operator as Operator, rule.threshold);

      // Log (without sensitive data)
      console.log(`[evaluate-audit] rule=${rule.id} metric=${rule.metric} value=${metricValue.toFixed(2)} triggered=${triggered}`);

      if (!triggered) continue;

      // Check cooldown
      const lastAlertAt = await getLastAlertForRule(supaAdmin, rule.id);
      const inCooldown = checkCooldown(lastAlertAt, rule.cooldown_hours);

      if (inCooldown) {
        console.log(`[evaluate-audit] rule=${rule.id} in cooldown, skipping`);
        continue;
      }

      // Insert alert
      await insertAlert(supaAdmin, rule, metricValue);
      alertsCreated++;
      console.log(`[evaluate-audit] rule=${rule.id} alert created`);
    }

    // Auto-chain if more rules to process
    if (hasMore) {
      const selfUrl = `${supabaseUrl}/functions/v1/evaluate-audit-rules`;
      handleAutoChain(selfUrl, serviceRoleKey, offset + BATCH_SIZE);
    }

    return new Response(JSON.stringify({
      evaluated,
      alerts_created: alertsCreated,
      hasMore,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[evaluate-audit] Error:', msg);
    return new Response(JSON.stringify({ error: 'Internal error', details: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
