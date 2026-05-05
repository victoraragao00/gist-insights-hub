import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

// ── Types ──

export type DemandPriority = "low" | "medium" | "high" | "urgent";
export type DemandEventType =
  | "created" | "moved" | "assigned" | "blocked"
  | "unblocked" | "edited" | "cancelled" | "linked_interaction";

export interface DemandRow extends Tables<"demands"> {
  clients?: { name: string } | null;
  demand_types?: { name: string; color: string | null; icon: string | null } | null;
  ticket_columns?: { name: string; color: string | null } | null;
  demand_areas?: { name: string; color: string | null } | null;
  user_profiles?: { full_name: string | null; email: string | null } | null;
  total_hours?: number;
}

export interface DemandFilters {
  client_id?: string;
  column_id?: string;
  priority?: DemandPriority;
  demand_type_id?: string;
  area_id?: string;
  search?: string;
  workspace?: "cx" | "tech";
  mine_user_id?: string;
  mine_collab_ids?: string[];
}

// ── Queries ──

export function useTicketColumns() {
  return useQuery({
    queryKey: ["ticket_columns"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_columns")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Tables<"ticket_columns">[];
    },
  });
}

export function useDemandTypes() {
  return useQuery({
    queryKey: ["demand_types"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_types")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Tables<"demand_types">[];
    },
  });
}

export function useDemands(filters?: DemandFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["demands", user?.id, filters],
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("demands")
        .select("*, clients(name), demand_types(name, color, icon), ticket_columns(name, color), demand_areas(name, color), user_profiles!assignee_id(full_name, email)")
        .order("column_id")
        .order("position", { ascending: true })
        .limit(200);

      if (filters?.client_id) query = query.eq("client_id", filters.client_id);
      if (filters?.column_id) query = query.eq("column_id", filters.column_id);
      if (filters?.priority) query = query.eq("priority", filters.priority);
      if (filters?.demand_type_id) query = query.eq("demand_type_id", filters.demand_type_id);
      if (filters?.area_id) query = query.eq("area_id", filters.area_id);
      if (filters?.workspace) query = query.eq("workspace", filters.workspace);
      if (filters?.search && filters.search.length >= 3) {
        query = query.ilike("title", `%${filters.search}%`);
      }
      if (filters?.mine_user_id) {
        const collabIds = filters.mine_collab_ids ?? [];
        if (collabIds.length > 0) {
          query = query.or(
            `assignee_id.eq.${filters.mine_user_id},id.in.(${collabIds.join(",")})`
          );
        } else {
          query = query.eq("assignee_id", filters.mine_user_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as DemandRow[];
      await attachTotalHours(rows);
      return rows;
    },
  });
}

async function attachTotalHours(rows: DemandRow[]): Promise<void> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from("demand_time_entries")
    .select("demand_id, started_at, ended_at, hours_manual")
    .in("demand_id", ids);
  if (error) {
    console.warn("[useDemands] total_hours aggregation failed:", error.message);
    return;
  }
  const totals = new Map<string, number>();
  for (const e of data ?? []) {
    let h = 0;
    if (e.hours_manual != null) h = Number(e.hours_manual);
    else if (e.started_at && e.ended_at) {
      h = (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 3_600_000;
    }
    totals.set(e.demand_id, (totals.get(e.demand_id) ?? 0) + h);
  }
  for (const row of rows) {
    row.total_hours = totals.get(row.id) ?? 0;
  }
}

export function useDemand(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("*, clients(name), demand_types(name, color, icon), ticket_columns(name, color), demand_areas(name, color), user_profiles!assignee_id(full_name, email)")
        .eq("id", demandId!)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? null) as DemandRow | null;
      if (row) await attachTotalHours([row]);
      return row;
    },
  });
}

export function useDemandActivities(demandId: string) {
  return useQuery({
    queryKey: ["demand_activities", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_activities")
        .select("*")
        .eq("demand_id", demandId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Tables<"demand_activities">[];
    },
  });
}

// ── Mutations ──

export function useCreateDemand() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      client_id: string;
      demand_type_id: string;
      priority: DemandPriority;
      column_id: string;
      area_id?: string;
      assignee_id?: string;
      
      description?: string;
      expected_result?: string;
      assignee?: string;
      notes?: string;
      workspace?: "cx" | "tech";
    }) => {
      const { data, error } = await supabase
        .from("demands")
        .insert({
          ...input,
          created_by: user?.id ?? null,
          position: 0,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Log activity
      const { error: actError } = await supabase.from("demand_activities").insert({
        demand_id: data.id,
        event_type: "created" as const,
        description: "Demanda criada",
        created_by: user?.id ?? null,
      });
      if (actError) console.warn("[useDemands] Activity log failed:", actError.message);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demanda criada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar demanda"),
  });
}

export function useMoveDemand() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      demandId: string;
      targetColumnId: string;
      targetPosition: number;
      sourceColumnName: string;
      targetColumnName: string;
      currentStartedAt: string | null;
      targetTriggersStartedAt: boolean;
      targetTriggersFinishedAt: boolean;
    }) => {
      const updates: Record<string, unknown> = {
        column_id: input.targetColumnId,
        position: input.targetPosition,
      };

      if (input.targetTriggersStartedAt && !input.currentStartedAt) {
        updates.started_at = new Date().toISOString();
      }
      if (input.targetTriggersFinishedAt) {
        updates.finished_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("demands")
        .update(updates)
        .eq("id", input.demandId);
      if (error) throw error;

      // Log activity
      const { error: actError } = await supabase.from("demand_activities").insert({
        demand_id: input.demandId,
        event_type: "moved" as const,
        description: `Movido de "${input.sourceColumnName}" para "${input.targetColumnName}"`,
        from_value: input.sourceColumnName,
        to_value: input.targetColumnName,
        created_by: user?.id ?? null,
      });
      if (actError) console.error("Activity log error:", actError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao mover demanda"),
  });
}

export function useUpdateDemand() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      fields: Record<string, unknown>;
      fieldLabel?: string;
    }) => {
      const { error } = await supabase
        .from("demands")
        .update(input.fields)
        .eq("id", input.id);
      if (error) throw error;

      const { error: actError } = await supabase.from("demand_activities").insert({
        demand_id: input.id,
        event_type: "edited" as const,
        description: input.fieldLabel ? `Campo "${input.fieldLabel}" atualizado` : "Demanda atualizada",
        created_by: user?.id ?? null,
      });
      if (actError) console.error("Activity log error:", actError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demanda atualizada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar demanda"),
  });
}

export function useDeleteDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (demandId: string) => {
      const { error } = await supabase
        .from("demands")
        .delete()
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Demanda excluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir demanda"),
  });
}
