import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type ProjectDateField = "planned_start" | "planned_end" | "actual_start" | "actual_end";

export interface ProjectDateChangeRow {
  id: string;
  project_id: string;
  field: ProjectDateField;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  note: string | null;
  user_profiles: { full_name: string | null; email: string | null } | null;
}

export function useProjectDateHistory(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery<ProjectDateChangeRow[]>({
    queryKey: ["project_date_history", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_date_changes")
        .select("id, project_id, field, old_value, new_value, changed_at, note, user_profiles!project_date_changes_changed_by_fkey(full_name, email)")
        .eq("project_id", projectId!)
        .order("changed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectDateChangeRow[];
    },
  });
}

export const DATE_FIELD_LABELS: Record<ProjectDateField, string> = {
  planned_start: "Início previsto",
  planned_end: "Fim previsto",
  actual_start: "Início real",
  actual_end: "Fim real",
};
