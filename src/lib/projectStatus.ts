export type ProjectStatus = "planning" | "active" | "completed" | "cancelled";

export interface ProjectStatsData {
  project_id: string;
  status: ProjectStatus;
  total_demands: number;
  completed: number;
  completion_pct: number;
  overdue_count: number;
  total_hours: number;
  meeting_hours?: number;
  hours_estimated: number | null;
  hours_progress_pct: number | null;
  by_column: Array<{ column_id: string; column_name: string; count: number }>;
}

export const statusConfig: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  planning: {
    label: "Planejamento",
    className:
      "bg-muted text-muted-foreground border-border",
  },
  active: {
    label: "Ativo",
    className:
      "bg-primary/10 text-primary border-primary/30",
  },
  completed: {
    label: "Concluído",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export function isOverdue(due_date: string | null | undefined): boolean {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}
