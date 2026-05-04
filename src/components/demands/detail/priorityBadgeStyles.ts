import type { DemandPriority } from "@/hooks/useDemands";

/**
 * Tailwind classes for priority badges (subtle background + readable text).
 * Uses semantic tokens where possible, with carefully scoped Tailwind palette
 * fallbacks for severity (red/amber/blue/slate) — the Design System allows
 * severity colors when no semantic token exists.
 */
export function priorityBadgeClass(priority: DemandPriority): string {
  switch (priority) {
    case "urgent":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "high":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900";
    case "medium":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900";
    case "low":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function priorityLabel(priority: DemandPriority): string {
  switch (priority) {
    case "urgent": return "Urgente";
    case "high": return "Alta";
    case "medium": return "Média";
    case "low": return "Baixa";
  }
}

/** Subtle column-status background for the header chip. */
export function columnBadgeClass(columnName: string | undefined): string {
  const name = (columnName ?? "").toLowerCase();
  if (name.includes("cancelad")) return "bg-muted text-muted-foreground border-border";
  if (name.includes("conclu") || name.includes("done") || name.includes("finaliz"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900";
  if (name.includes("bloque")) return "bg-destructive/10 text-destructive border-destructive/30";
  // Default: brand purple tint
  return "bg-primary/10 text-primary border-primary/20";
}
