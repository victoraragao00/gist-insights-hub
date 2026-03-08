/**
 * evaluate-audit-rules/logic.ts
 * Pure functions for rule evaluation — no I/O, fully testable.
 */

export type Operator = '>' | '<' | '>=' | '<=' | '=';

export interface AuditRule {
  id: string;
  name: string;
  metric: string;
  operator: Operator;
  threshold: number;
  window_hours: number | null;
  cooldown_hours: number | null;
  client_id: string | null;
  active: boolean;
}

/**
 * Evaluates a single rule against a metric value.
 * Returns true if the rule condition is met (alert should be triggered).
 */
export function evaluateRule(
  metricValue: number,
  operator: Operator,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return metricValue > threshold;
    case '<':
      return metricValue < threshold;
    case '>=':
      return metricValue >= threshold;
    case '<=':
      return metricValue <= threshold;
    case '=':
      return metricValue === threshold;
    default:
      // Unknown operator — fail safe, don't trigger
      return false;
  }
}

/**
 * Checks if a rule is in cooldown based on the last alert timestamp.
 * Returns true if the rule is still in cooldown (should NOT trigger).
 * Returns false if the rule can trigger a new alert.
 */
export function checkCooldown(
  lastAlertAt: string | null,
  cooldownHours: number | null
): boolean {
  // No cooldown configured or no last alert — can trigger
  if (!cooldownHours || cooldownHours <= 0 || !lastAlertAt) {
    return false;
  }

  const lastAlert = new Date(lastAlertAt);
  const cooldownEnd = new Date(lastAlert.getTime() + cooldownHours * 60 * 60 * 1000);
  const now = new Date();

  // Still in cooldown window
  return now < cooldownEnd;
}

/**
 * Formats an alert message based on rule and metric value.
 */
export function formatAlertMessage(
  ruleName: string,
  metric: string,
  operator: Operator,
  threshold: number,
  metricValue: number
): string {
  const operatorLabels: Record<string, string> = {
    '>': 'ultrapassou',
    '>=': 'atingiu ou ultrapassou',
    '<': 'caiu abaixo de',
    '<=': 'atingiu ou caiu abaixo de',
    '=': 'atingiu exatamente',
  };

  const opLabel = operatorLabels[operator] || 'violou';
  
  return `[${ruleName}] Métrica "${metric}" ${opLabel} ${threshold} (valor atual: ${metricValue.toFixed(2)})`;
}
