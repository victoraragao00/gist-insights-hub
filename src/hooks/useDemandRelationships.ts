import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type RelationshipType = "blocks" | "related" | "linked";

export interface DependencyItem {
  id: string;
  title: string;
  finished_at?: string | null;
  is_blocked?: boolean | null;
  status?: "done" | "blocked" | "active";
  type?: RelationshipType;
}

export interface DemandRelationships {
  blocks_these: DependencyItem[];
  blocked_by: DependencyItem[];
  related: DependencyItem[];
}

export interface RelationshipRow {
  id: string;
  demand_id: string;
  related_demand_id: string;
  relationship_type: RelationshipType;
}

export function useDemandRelationships(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-relationships", demandId],
    enabled: !!demandId,
    staleTime: 30_000,
    queryFn: async (): Promise<DemandRelationships> => {
      const { data, error } = await supabase.rpc("get_demand_relationships", {
        p_demand_id: demandId!,
      });
      if (error) throw error;
      const empty: DemandRelationships = { blocks_these: [], blocked_by: [], related: [] };
      return { ...empty, ...((data as unknown as DemandRelationships) ?? {}) };
    },
  });
}

/**
 * Returns the raw `demand_relationships` rows where this demand participates,
 * so the UI knows the `id` of each relationship (needed to delete).
 */
export function useDemandRelationshipRows(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-relationship-rows", demandId],
    enabled: !!demandId,
    staleTime: 30_000,
    queryFn: async (): Promise<RelationshipRow[]> => {
      const { data, error } = await supabase
        .from("demand_relationships")
        .select("id, demand_id, related_demand_id, relationship_type")
        .or(`demand_id.eq.${demandId},related_demand_id.eq.${demandId}`);
      if (error) throw error;
      return (data ?? []) as RelationshipRow[];
    },
  });
}

interface AddRelationshipInput {
  demandId: string;
  relatedId: string;
  type: RelationshipType;
  createdBy: string | null | undefined;
}

export function useAddRelationship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, relatedId, type, createdBy }: AddRelationshipInput) => {
      const { error } = await supabase.from("demand_relationships").insert({
        demand_id: demandId,
        related_demand_id: relatedId,
        relationship_type: type,
        created_by: createdBy ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { demandId, relatedId }) => {
      queryClient.invalidateQueries({ queryKey: ["demand-relationships", demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand-relationships", relatedId] });
      queryClient.invalidateQueries({ queryKey: ["demand-relationship-rows", demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand-relationship-rows", relatedId] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["demand"] });
      queryClient.invalidateQueries({ queryKey: ["blocking-stalled"] });
      toast.success("Relação criada");
    },
    onError: (err: Error) => toast.error("Erro ao vincular: " + err.message),
  });
}

interface RemoveRelationshipInput {
  id: string;
  demandId: string;
  relatedId?: string;
}

export function useRemoveRelationship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: RemoveRelationshipInput) => {
      const { error } = await supabase.from("demand_relationships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { demandId, relatedId }) => {
      queryClient.invalidateQueries({ queryKey: ["demand-relationships", demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand-relationship-rows", demandId] });
      if (relatedId) {
        queryClient.invalidateQueries({ queryKey: ["demand-relationships", relatedId] });
        queryClient.invalidateQueries({ queryKey: ["demand-relationship-rows", relatedId] });
      }
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["blocking-stalled"] });
      toast.success("Relação removida");
    },
    onError: (err: Error) => toast.error("Erro ao remover: " + err.message),
  });
}
