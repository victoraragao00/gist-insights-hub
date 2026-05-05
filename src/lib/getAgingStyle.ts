import type { DemandRow } from "@/hooks/useDemands";

export function getAgingDays(demand: DemandRow): number {
  const ref =
    demand.started_at ?? demand.last_updated ?? demand.created_at;
  if (!ref) return 0;
  const diff = Date.now() - new Date(ref).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export interface AgingStyle {
  label: string;
  className: string;
}

export function getAgingStyle(days: number): AgingStyle | null {
  if (days < 3) return null;
  if (days < 7)
    return {
      label: `${days}d`,
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300",
    };
  if (days < 14)
    return {
      label: `${days}d`,
      className:
        "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
    };
  return {
    label: `${days}d`,
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
  };
}
