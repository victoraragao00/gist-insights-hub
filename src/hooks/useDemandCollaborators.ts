import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface DemandCollaborator {
  id: string;
  demand_id: string;
  user_id: string;
  added_at: string | null;
  full_name: string | null;
  email: string | null;
}

const SELECT =
  "id, demand_id, user_id, added_at, user_profiles!demand_collaborators_user_id_fkey(full_name, email)";

type RawRow = {
  id: string;
  demand_id: string;
  user_id: string;
  added_at: string | null;
  user_profiles: { full_name: string | null; email: string | null } | null;
};

function mapRow(row: RawRow): DemandCollaborator {
  return {
    id: row.id,
    demand_id: row.demand_id,
    user_id: row.user_id,
    added_at: row.added_at,
    full_name: row.user_profiles?.full_name ?? null,
    email: row.user_profiles?.email ?? null,
  };
}

export function useDemandCollaborators(demandId: string | undefined) {
  const { user } = useAuth();
  return useQuery<DemandCollaborator[]>({
    queryKey: ["demand_collaborators", user?.id, demandId],
    enabled: !!demandId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_collaborators")
        .select(SELECT)
        .eq("demand_id", demandId!);
      if (error) throw error;
      return ((data as unknown as RawRow[]) ?? []).map(mapRow);
    },
  });
}

export function useDemandCollaboratorsBatch(demandIds: string[]) {
  const { user } = useAuth();
  const stableKey = [...demandIds].sort().join(",");
  return useQuery<Record<string, DemandCollaborator[]>>({
    queryKey: ["demand_collaborators_batch", user?.id, stableKey],
    enabled: !!user?.id && demandIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_collaborators")
        .select(SELECT)
        .in("demand_id", demandIds);
      if (error) throw error;
      const out: Record<string, DemandCollaborator[]> = {};
      for (const r of ((data as unknown as RawRow[]) ?? [])) {
        const c = mapRow(r);
        if (!out[c.demand_id]) out[c.demand_id] = [];
        out[c.demand_id].push(c);
      }
      return out;
    },
  });
}

export function useMyCollaboratorDemandIds(enabled: boolean) {
  const { user } = useAuth();
  return useQuery<string[]>({
    queryKey: ["my_collaborator_demand_ids", user?.id],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_collaborators")
        .select("demand_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.demand_id);
    },
  });
}

export function useAddCollaborator() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { demandId: string; userId: string }) => {
      const { error } = await supabase
        .from("demand_collaborators")
        .insert({
          demand_id: input.demandId,
          user_id: input.userId,
          added_by: user?.id ?? null,
        });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["demand_collaborators_batch"] });
      queryClient.invalidateQueries({ queryKey: ["my_collaborator_demand_ids"] });
      toast.success("Colaborador adicionado");
    },
    onError: (err) =>
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro")),
  });
}

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { demandId: string; userId: string }) => {
      const { error } = await supabase
        .from("demand_collaborators")
        .delete()
        .eq("demand_id", input.demandId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["demand_collaborators_batch"] });
      queryClient.invalidateQueries({ queryKey: ["my_collaborator_demand_ids"] });
      toast.success("Colaborador removido");
    },
    onError: (err) =>
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro")),
  });
}
