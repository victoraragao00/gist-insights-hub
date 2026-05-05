import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AreaWorkspace = "cx" | "tech" | "both";

export interface DemandArea {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  position: number;
  created_at: string | null;
  workspace: AreaWorkspace;
}

export function useDemandAreas() {
  return useQuery({
    queryKey: ["demand_areas"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_areas")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DemandArea[];
    },
  });
}

export function useAllDemandAreas() {
  return useQuery({
    queryKey: ["demand_areas_all"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_areas")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DemandArea[];
    },
  });
}

/**
 * Areas active and visible in a workspace. `both` always shows up.
 */
export function useAreasByWorkspace(workspace: "cx" | "tech") {
  const { data: areas = [], ...rest } = useDemandAreas();
  const filtered = areas.filter(
    (a) => a.workspace === workspace || a.workspace === "both",
  );
  return { ...rest, data: filtered };
}

export function useManageAreas() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["demand_areas"] });
    queryClient.invalidateQueries({ queryKey: ["demand_areas_all"] });
  };

  const addArea = useMutation({
    mutationFn: async (input: {
      name: string;
      color?: string;
      position: number;
      workspace?: AreaWorkspace;
    }) => {
      const { error } = await supabase.from("demand_areas").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Área criada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar área"),
  });

  const updateArea = useMutation({
    mutationFn: async (input: { id: string; fields: Record<string, unknown> }) => {
      const { error } = await supabase.from("demand_areas").update(input.fields).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Área atualizada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar área"),
  });

  const deactivateArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demand_areas").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Área desativada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao desativar área"),
  });

  const reactivateArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demand_areas").update({ active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Área reativada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao reativar área"),
  });

  const deleteArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demand_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Área excluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir área"),
  });

  return { addArea, updateArea, deactivateArea, reactivateArea, deleteArea };
}
