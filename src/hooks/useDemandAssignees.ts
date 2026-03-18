import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DemandAssignee {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  active: boolean;
  created_at: string | null;
}

export function useDemandAssignees() {
  return useQuery({
    queryKey: ["demand_assignees"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_assignees")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DemandAssignee[];
    },
  });
}

export function useAllDemandAssignees() {
  return useQuery({
    queryKey: ["demand_assignees_all"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_assignees")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DemandAssignee[];
    },
  });
}

export function useManageAssignees() {
  const queryClient = useQueryClient();

  const addAssignee = useMutation({
    mutationFn: async (input: { name: string; email?: string; role?: string }) => {
      const { error } = await supabase.from("demand_assignees").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_assignees"] });
      queryClient.invalidateQueries({ queryKey: ["demand_assignees_all"] });
      toast.success("Responsável criado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar responsável"),
  });

  const updateAssignee = useMutation({
    mutationFn: async (input: { id: string; fields: Record<string, unknown> }) => {
      const { error } = await supabase.from("demand_assignees").update(input.fields).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_assignees"] });
      queryClient.invalidateQueries({ queryKey: ["demand_assignees_all"] });
      toast.success("Responsável atualizado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar"),
  });

  const deactivateAssignee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demand_assignees").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_assignees"] });
      queryClient.invalidateQueries({ queryKey: ["demand_assignees_all"] });
      toast.success("Responsável desativado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao desativar"),
  });

  const reactivateAssignee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demand_assignees").update({ active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_assignees"] });
      queryClient.invalidateQueries({ queryKey: ["demand_assignees_all"] });
      toast.success("Responsável reativado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao reativar"),
  });

  const deleteAssignee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demand_assignees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_assignees"] });
      queryClient.invalidateQueries({ queryKey: ["demand_assignees_all"] });
      toast.success("Responsável excluído");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir"),
  });

  return { addAssignee, updateAssignee, deactivateAssignee, reactivateAssignee, deleteAssignee };
}
