/**
 * evaluate-audit-rules/index.test.ts
 * Unit tests for logic.ts (m13 compliance)
 */

import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { evaluateRule, checkCooldown, formatAlertMessage } from './logic.ts';

// ── evaluateRule tests (5 cases) ──

Deno.test('evaluateRule: operator > with value above → true', () => {
  assertEquals(evaluateRule(85, '>', 80), true);
});

Deno.test('evaluateRule: operator > with value equal → false', () => {
  assertEquals(evaluateRule(80, '>', 80), false);
});

Deno.test('evaluateRule: operator >= with value equal → true', () => {
  assertEquals(evaluateRule(80, '>=', 80), true);
});

Deno.test('evaluateRule: operator < with value below → true', () => {
  assertEquals(evaluateRule(50, '<', 80), true);
});

Deno.test('evaluateRule: unknown operator → false', () => {
  assertEquals(evaluateRule(100, '!=' as any, 80), false);
});

// ── checkCooldown tests (3 cases) ──

Deno.test('checkCooldown: no previous alert → false (can trigger)', () => {
  assertEquals(checkCooldown(null, 24), false);
});

Deno.test('checkCooldown: last alert older than cooldown → false (can trigger)', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assertEquals(checkCooldown(twoHoursAgo, 1), false); // 1h cooldown, 2h ago
});

Deno.test('checkCooldown: last alert within cooldown → true (cannot trigger)', () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  assertEquals(checkCooldown(thirtyMinutesAgo, 1), true); // 1h cooldown, 30min ago
});

// ── formatAlertMessage test ──

Deno.test('formatAlertMessage: formats correctly', () => {
  const msg = formatAlertMessage('Score Alto', 'score_prioridade', '>', 80, 92.5);
  assertEquals(msg.includes('Score Alto'), true);
  assertEquals(msg.includes('score_prioridade'), true);
  assertEquals(msg.includes('ultrapassou'), true);
  assertEquals(msg.includes('92.50'), true);
});
