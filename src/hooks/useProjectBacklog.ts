import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export type BacklogStatus = "open" | "converted" | "discarded";

export interface BacklogItem {
  id: string;
  project_id: string;
  title: string;
  notes: string | null;
  status: BacklogStatus;
  position: number;
  converted_demand_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectBacklog(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery<BacklogItem[]>({
    queryKey: ["project_backlog", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_backlog_items")
        .select("*")
        .eq("project_id", projectId!)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as BacklogItem[];
    },
  });
}

export function useCreateBacklogItem(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; notes?: string | null; position?: number }) => {
      const { data, error } = await supabase
        .from("project_backlog_items")
        .insert({
          project_id: projectId!,
          created_by: user!.id,
          title: input.title,
          notes: input.notes ?? null,
          position: input.position ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BacklogItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_backlog", projectId] }),
    onError: (err: Error) => toast.error(`Erro ao criar tópico: ${err.message}`),
  });
}

export function useUpdateBacklogItem(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<Omit<BacklogItem, "id" | "project_id" | "created_at" | "updated_at" | "created_by">>) => {
      const { error } = await supabase
        .from("project_backlog_items")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_backlog", projectId] }),
    onError: (err: Error) => toast.error(`Erro ao atualizar tópico: ${err.message}`),
  });
}

export function useDeleteBacklogItem(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_backlog_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_backlog", projectId] });
      toast.success("Tópico removido");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });
}

export function useMarkBacklogConverted(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, demandId }: { id: string; demandId: string }) => {
      const { error } = await supabase
        .from("project_backlog_items")
        .update({
          status: "converted",
          converted_demand_id: demandId,
          converted_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_backlog", projectId] }),
  });
}
