import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { detectPatterns, calculateScore } from "./logic.ts";
import type { InteractionRow, SeverityWeights, RecencyConfig } from "./logic.ts";

const DEFAULT_SEVERITY: SeverityWeights = { critico: 10, alerta: 5, atencao: 2 };
const DEFAULT_RECENCY: RecencyConfig = {
  recentDays: 3, mediumDays: 7,
  recentMultiplier: 2.0, mediumMultiplier: 1.5, baseMultiplier: 1.0,
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}

// ── calculateScore tests ──

Deno.test("calculateScore: returns 0 when patterns is empty", () => {
  const score = calculateScore([], [], 4, DEFAULT_SEVERITY, DEFAULT_RECENCY);
  assertEquals(score, 0);
});

Deno.test("calculateScore: weight_multiplier=4 produces 4x vs weight_multiplier=1", () => {
  const interactions: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(1) },
    { theme: "erp", tone: "critico", sender_raw: "u2", occurred_at: hoursAgo(1) },
  ];
  const patterns = detectPatterns(interactions, 2, 15);
  const score4 = calculateScore(patterns, interactions, 4, DEFAULT_SEVERITY, DEFAULT_RECENCY);
  const score1 = calculateScore(patterns, interactions, 1, DEFAULT_SEVERITY, DEFAULT_RECENCY);
  assertEquals(score4, score1 * 4);
});

Deno.test("calculateScore: recent interactions score higher than old ones", () => {
  const recentIx: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(1) },
    { theme: "erp", tone: "critico", sender_raw: "u2", occurred_at: hoursAgo(1) },
  ];
  const oldIx: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(24 * 10) },
    { theme: "erp", tone: "critico", sender_raw: "u2", occurred_at: hoursAgo(24 * 10) },
  ];
  const pRecent = detectPatterns(recentIx, 2, 15);
  const pOld = detectPatterns(oldIx, 2, 15);
  const scoreRecent = calculateScore(pRecent, recentIx, 1, DEFAULT_SEVERITY, DEFAULT_RECENCY);
  const scoreOld = calculateScore(pOld, oldIx, 1, DEFAULT_SEVERITY, DEFAULT_RECENCY);
  assertEquals(scoreRecent > scoreOld, true);
});

Deno.test("calculateScore: score_final = score_bruto * weightMultiplier (no cap)", () => {
  // 10 users × critico(10) × recent(2.0) = 200 bruto × 4 = 800
  const interactions: InteractionRow[] = Array.from({ length: 10 }, (_, i) => ({
    theme: "erp", tone: "critico" as const, sender_raw: `u${i}`, occurred_at: hoursAgo(1),
  }));
  const patterns = detectPatterns(interactions, 2, 15);
  const score = calculateScore(patterns, interactions, 4, DEFAULT_SEVERITY, DEFAULT_RECENCY);
  assertEquals(score, 800);
});

// ── detectPatterns tests ──

Deno.test("detectPatterns: returns empty when user_count < thresholdUsers", () => {
  const interactions: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(1) },
  ];
  const patterns = detectPatterns(interactions, 2, 15);
  assertEquals(patterns.length, 0);
});

Deno.test("detectPatterns: returns pattern when user_count >= thresholdUsers", () => {
  const interactions: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(1) },
    { theme: "erp", tone: "critico", sender_raw: "u2", occurred_at: hoursAgo(1) },
  ];
  const patterns = detectPatterns(interactions, 2, 15);
  assertEquals(patterns.length, 1);
  assertEquals(patterns[0].user_count, 2);
  assertEquals(patterns[0].theme, "erp");
});

Deno.test("detectPatterns: severity 'high' for tone critico", () => {
  const interactions: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(1) },
    { theme: "erp", tone: "critico", sender_raw: "u2", occurred_at: hoursAgo(1) },
  ];
  const patterns = detectPatterns(interactions, 2, 15);
  assertEquals(patterns[0].severity, "high");
  assertEquals(patterns[0].worst_tone, "critico");
});

Deno.test("detectPatterns: severity 'high' for tone alerta, worst_tone preserved", () => {
  const interactions: InteractionRow[] = [
    { theme: "erp", tone: "alerta", sender_raw: "u1", occurred_at: hoursAgo(1) },
    { theme: "erp", tone: "atencao", sender_raw: "u2", occurred_at: hoursAgo(1) },
  ];
  const patterns = detectPatterns(interactions, 2, 15);
  assertEquals(patterns[0].severity, "high");
  assertEquals(patterns[0].worst_tone, "alerta");
});

Deno.test("detectPatterns: two distinct themes produce two separate patterns", () => {
  const interactions: InteractionRow[] = [
    { theme: "erp", tone: "critico", sender_raw: "u1", occurred_at: hoursAgo(1) },
    { theme: "erp", tone: "critico", sender_raw: "u2", occurred_at: hoursAgo(1) },
    { theme: "onboarding", tone: "atencao", sender_raw: "u3", occurred_at: hoursAgo(1) },
    { theme: "onboarding", tone: "atencao", sender_raw: "u4", occurred_at: hoursAgo(1) },
  ];
  const patterns = detectPatterns(interactions, 2, 15);
  assertEquals(patterns.length, 2);
  const themes = patterns.map(p => p.theme).sort();
  assertEquals(themes, ["erp", "onboarding"]);
});
