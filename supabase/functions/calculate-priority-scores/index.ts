import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Environment-driven constants (zero hardcoded business values) ──

const SEVERITY_WEIGHTS: Record<string, number> = {
  critico: Number(Deno.env.get('PRIORITY_SEVERITY_CRITICO') || '10'),
  alerta: Number(Deno.env.get('PRIORITY_SEVERITY_ALERTA') || '5'),
  atencao: Number(Deno.env.get('PRIORITY_SEVERITY_ATENCAO') || '2'),
};

const RECENCY_RECENT_DAYS = Number(Deno.env.get('PRIORITY_RECENCY_RECENT_DAYS') || '3');
const RECENCY_MEDIUM_DAYS = Number(Deno.env.get('PRIORITY_RECENCY_MEDIUM_DAYS') || '7');
const RECENCY_RECENT_MULTIPLIER = Number(Deno.env.get('PRIORITY_RECENCY_RECENT_MULTIPLIER') || '2.0');
const RECENCY_MEDIUM_MULTIPLIER = Number(Deno.env.get('PRIORITY_RECENCY_MEDIUM_MULTIPLIER') || '1.5');
const RECENCY_BASE_MULTIPLIER = Number(Deno.env.get('PRIORITY_RECENCY_BASE_MULTIPLIER') || '1.0');
const BATCH_SIZE = Number(Deno.env.get('PRIORITY_BATCH_SIZE') || '20');

// ── Types ──

interface PriorityConfig {
  id: string;
  client_id: string;
  tier: string;
  weight_multiplier: number;
  recurrence_window_days: number;
  recurrence_threshold_users: number;
}

interface Pattern {
  type: 'recurrence';
  theme: string;
  user_count: number;
  window_days: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface InteractionRow {
  theme: string | null;
  tone: string | null;
  sender_raw: string | null;
  occurred_at: string;
}

// ── Pure logic functions (single responsibility each) ──

async function fetchClientConfigs(
  supaAdmin: ReturnType<typeof createClient>,
  offset: number,
  batchSize: number
): Promise<{ configs: PriorityConfig[]; hasMore: boolean }> {
  const { data, error } = await supaAdmin
    .from('client_priority_config')
    .select('id, client_id, tier, weight_multiplier, recurrence_window_days, recurrence_threshold_users')
    .eq('active', true)
    .order('client_id')
    .range(offset, offset + batchSize - 1);

  if (error) throw new Error(`fetchClientConfigs failed: ${error.message}`);

  const configs = (data || []) as PriorityConfig[];
  return { configs, hasMore: configs.length === batchSize };
}

async function fetchClientInteractions(
  supaAdmin: ReturnType<typeof createClient>,
  clientId: string,
  windowDays: number
): Promise<InteractionRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const { data, error } = await supaAdmin
    .from('interactions')
    .select('theme, tone, sender_raw, occurred_at')
    .eq('client_id', clientId)
    .in('tone', ['atencao', 'alerta', 'critico'])
    .not('classified_at', 'is', null)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false })
    .limit(1000);

  if (error) throw new Error(`fetchClientInteractions failed: ${error.message}`);
  return (data || []) as InteractionRow[];
}

function detectPatterns(
  interactions: InteractionRow[],
  thresholdUsers: number,
  windowDays: number
): Pattern[] {
  // Group by theme, count distinct sender_raw per theme
  const themeGroups = new Map<string, { senders: Set<string>; worstTone: string }>();

  for (const ix of interactions) {
    if (!ix.theme) continue;
    const group = themeGroups.get(ix.theme) || { senders: new Set<string>(), worstTone: 'atencao' };
    if (ix.sender_raw) group.senders.add(ix.sender_raw);

    // Track worst tone: critico > alerta > atencao
    const toneRank: Record<string, number> = { critico: 3, alerta: 2, atencao: 1 };
    if (ix.tone && (toneRank[ix.tone] || 0) > (toneRank[group.worstTone] || 0)) {
      group.worstTone = ix.tone;
    }
    themeGroups.set(ix.theme, group);
  }

  const patterns: Pattern[] = [];
  for (const [theme, group] of themeGroups) {
    const userCount = group.senders.size;
    if (userCount < thresholdUsers) continue;

    // Severity based on worst tone: critico/alerta → high, atencao → medium
    const severity: Pattern['severity'] =
      group.worstTone === 'critico' || group.worstTone === 'alerta' ? 'high' : 'medium';

    patterns.push({
      type: 'recurrence',
      theme,
      user_count: userCount,
      window_days: windowDays,
      severity,
      description: `${userCount} usuários · ${theme} · ${windowDays} dias`,
    });
  }

  return patterns;
}

function calculateScore(
  patterns: Pattern[],
  interactions: InteractionRow[],
  weightMultiplier: number
): number {
  if (patterns.length === 0) return 0;

  const now = Date.now();
  const recentMs = RECENCY_RECENT_DAYS * 86400000;
  const mediumMs = RECENCY_MEDIUM_DAYS * 86400000;

  // Compute average recency multiplier per theme from interactions
  const themeRecency = new Map<string, number>();
  for (const ix of interactions) {
    if (!ix.theme) continue;
    const ageMs = now - new Date(ix.occurred_at).getTime();
    let recencyWeight = RECENCY_BASE_MULTIPLIER;
    if (ageMs <= recentMs) recencyWeight = RECENCY_RECENT_MULTIPLIER;
    else if (ageMs <= mediumMs) recencyWeight = RECENCY_MEDIUM_MULTIPLIER;

    const current = themeRecency.get(ix.theme) || recencyWeight;
    // Keep the highest recency weight for the theme
    if (recencyWeight > current) themeRecency.set(ix.theme, recencyWeight);
    else if (!themeRecency.has(ix.theme)) themeRecency.set(ix.theme, recencyWeight);
  }

  let scoreBruto = 0;
  for (const pattern of patterns) {
    const severityWeight = pattern.severity === 'high'
      ? SEVERITY_WEIGHTS.critico
      : pattern.severity === 'medium'
        ? SEVERITY_WEIGHTS.atencao
        : SEVERITY_WEIGHTS.atencao;
    const recencyWeight = themeRecency.get(pattern.theme) || RECENCY_BASE_MULTIPLIER;
    scoreBruto += pattern.user_count * severityWeight * recencyWeight;
  }

  return scoreBruto * weightMultiplier;
}

async function upsertScore(
  supaAdmin: ReturnType<typeof createClient>,
  clientId: string,
  score: number,
  patterns: Pattern[]
): Promise<void> {
  const { error } = await supaAdmin
    .from('priority_scores')
    .upsert(
      {
        client_id: clientId,
        score,
        patterns: patterns as unknown as Record<string, unknown>[],
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    );

  if (error) throw new Error(`upsertScore failed for client=${clientId}: ${error.message}`);
}

function handleAutoChain(selfUrl: string, serviceRoleKey: string, nextOffset: number): void {
  fetch(selfUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ _offset: nextOffset }),
  }).catch(() => {}); // fire-and-forget — cron is the safety net
}

// ── Auth check for manual triggers ──

async function checkAdminRole(
  supaAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supaAdmin
    .from('user_client_access')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1);

  if (error) return false;
  return (data || []).length > 0;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supaAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { force, client_id: singleClientId, _offset } = body as {
      force?: boolean;
      client_id?: string;
      _offset?: number;
    };

    // ── Auth: determine if manual trigger (JWT) or automated (service role) ──
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      // Manual trigger — validate JWT and admin role
      const supaAuth = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await supaAuth.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isAdmin = await checkAdminRole(supaAdmin, claimsData.user.id);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Single client mode ──
    if (singleClientId) {
      const { data: configData, error: configError } = await supaAdmin
        .from('client_priority_config')
        .select('id, client_id, tier, weight_multiplier, recurrence_window_days, recurrence_threshold_users')
        .eq('client_id', singleClientId)
        .eq('active', true)
        .single();

      if (configError || !configData) {
        return new Response(JSON.stringify({ error: 'Client config not found or inactive' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const config = configData as PriorityConfig;
      const interactions = await fetchClientInteractions(supaAdmin, config.client_id, config.recurrence_window_days);
      const patterns = detectPatterns(interactions, config.recurrence_threshold_users, config.recurrence_window_days);
      const score = calculateScore(patterns, interactions, config.weight_multiplier);
      await upsertScore(supaAdmin, config.client_id, score, patterns);

      console.log(`[calculate-priority] client=${config.client_id} score=${score} patterns=${patterns.length}`);

      return new Response(JSON.stringify({
        processed: 1,
        hasMore: false,
        calculatedAt: new Date().toISOString(),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Batch mode ──
    const offset = _offset || 0;
    const { configs, hasMore } = await fetchClientConfigs(supaAdmin, offset, BATCH_SIZE);

    let processed = 0;
    for (const config of configs) {
      const interactions = await fetchClientInteractions(supaAdmin, config.client_id, config.recurrence_window_days);
      const patterns = detectPatterns(interactions, config.recurrence_threshold_users, config.recurrence_window_days);
      const score = calculateScore(patterns, interactions, config.weight_multiplier);
      await upsertScore(supaAdmin, config.client_id, score, patterns);
      processed++;
      console.log(`[calculate-priority] client=${config.client_id} score=${score} patterns=${patterns.length}`);
    }

    // Auto-chain if more clients to process
    if (hasMore) {
      const selfUrl = `${supabaseUrl}/functions/v1/calculate-priority-scores`;
      handleAutoChain(selfUrl, serviceRoleKey, offset + BATCH_SIZE);
    }

    return new Response(JSON.stringify({
      processed,
      hasMore,
      calculatedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[calculate-priority] Error:', msg);
    return new Response(JSON.stringify({ error: 'Internal error', details: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
