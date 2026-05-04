/**
 * Format a numeric hours value into a human-readable label.
 * Examples: 1.5 -> "1h 30min"; 0.25 -> "15min"; 3 -> "3h"
 */
export function formatHours(hours: number | null | undefined): string {
  if (!hours || hours <= 0) return "0min";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Format an elapsed duration in seconds as HH:MM:SS for the running stopwatch.
 */
export function formatStopwatch(elapsedSeconds: number): string {
  const s = Math.max(0, Math.floor(elapsedSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => v.toString().padStart(2, "0")).join(":");
}
