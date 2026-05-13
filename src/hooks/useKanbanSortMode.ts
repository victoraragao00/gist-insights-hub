import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type KanbanSortMode = "manual" | "oldest_first" | "newest_first" | "priority";

const SETTING_KEY = "kanban_sort_mode";
const VALID: KanbanSortMode[] = ["manual", "oldest_first", "newest_first", "priority"];

export function useKanbanSortMode() {
  return useQuery<KanbanSortMode>({
    queryKey: ["app_settings", SETTING_KEY],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      const raw = (data?.value ?? "manual") as unknown;
      const val = typeof raw === "string" ? raw : "manual";
      return (VALID.includes(val as KanbanSortMode) ? val : "manual") as KanbanSortMode;
    },
  });
}

export function useUpdateKanbanSortMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mode: KanbanSortMode) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: mode as unknown as object, updated_at: new Date().toISOString() })
        .eq("key", SETTING_KEY);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings", SETTING_KEY] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Ordenação atualizada");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortDemandsByMode<T extends { position: number; created_at: string | null; priority: string }>(
  demands: T[],
  mode: KanbanSortMode
): T[] {
  const arr = [...demands];
  switch (mode) {
    case "oldest_first":
      return arr.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    case "newest_first":
      return arr.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    case "priority":
      return arr.sort((a, b) => {
        const pa = PRIORITY_WEIGHT[a.priority] ?? 9;
        const pb = PRIORITY_WEIGHT[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
    case "manual":
    default:
      return arr.sort((a, b) => a.position - b.position);
  }
}
