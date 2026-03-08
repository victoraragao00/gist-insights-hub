// Pure logic functions for priority score calculation
// Extracted for testability — no I/O, no Deno.env, no Supabase client

// ── Types ──

export interface Pattern {
  type: 'recurrence';
  theme: string;
  user_count: number;
  window_days: number;
  severity: 'high' | 'medium' | 'low';
  worst_tone: string;
  description: string;
}

export interface InteractionRow {
  theme: string | null;
  tone: string | null;
  sender_raw: string | null;
  occurred_at: string;
}

export interface SeverityWeights {
  critico: number;
  alerta: number;
  atencao: number;
  [key: string]: number;
}

export interface RecencyConfig {
  recentDays: number;
  mediumDays: number;
  recentMultiplier: number;
  mediumMultiplier: number;
  baseMultiplier: number;
}

// ── detectPatterns ──

export function detectPatterns(
  interactions: InteractionRow[],
  thresholdUsers: number,
  windowDays: number
): Pattern[] {
  const themeGroups = new Map<string, { senders: Set<string>; worstTone: string }>();

  for (const ix of interactions) {
    if (!ix.theme) continue;
    const group = themeGroups.get(ix.theme) || { senders: new Set<string>(), worstTone: 'atencao' };
    if (ix.sender_raw) group.senders.add(ix.sender_raw);

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

    const severity: Pattern['severity'] =
      group.worstTone === 'critico' || group.worstTone === 'alerta' ? 'high' : 'medium';

    patterns.push({
      type: 'recurrence',
      theme,
      user_count: userCount,
      window_days: windowDays,
      severity,
      worst_tone: group.worstTone,
      description: `${userCount} usuários · ${theme} · ${windowDays} dias`,
    });
  }

  return patterns;
}

// ── calculateScore ──

export function calculateScore(
  patterns: Pattern[],
  interactions: InteractionRow[],
  weightMultiplier: number,
  severityWeights: SeverityWeights,
  recencyConfig: RecencyConfig
): number {
  if (patterns.length === 0) return 0;

  const now = Date.now();
  const recentMs = recencyConfig.recentDays * 86400000;
  const mediumMs = recencyConfig.mediumDays * 86400000;

  const themeRecency = new Map<string, number>();
  for (const ix of interactions) {
    if (!ix.theme) continue;
    const ageMs = now - new Date(ix.occurred_at).getTime();
    let recencyWeight = recencyConfig.baseMultiplier;
    if (ageMs <= recentMs) recencyWeight = recencyConfig.recentMultiplier;
    else if (ageMs <= mediumMs) recencyWeight = recencyConfig.mediumMultiplier;

    const current = themeRecency.get(ix.theme);
    if (current === undefined || recencyWeight > current) {
      themeRecency.set(ix.theme, recencyWeight);
    }
  }

  let scoreBruto = 0;
  for (const pattern of patterns) {
    const severityWeight = severityWeights[pattern.worst_tone] || severityWeights.atencao;
    const recencyWeight = themeRecency.get(pattern.theme) || recencyConfig.baseMultiplier;
    scoreBruto += pattern.user_count * severityWeight * recencyWeight;
  }

  return scoreBruto * weightMultiplier;
}
