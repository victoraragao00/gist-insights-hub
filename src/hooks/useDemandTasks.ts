import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

export type DemandTaskStatus = "open" | "in_progress" | "done";

export interface DemandTaskRow extends Tables<"demand_tasks"> {
  user_profiles?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface DemandTaskStats {
  total: number;
  done: number;
  in_progress: number;
  open: number;
  completion_pct: number;
  hours_estimated_sum: number;
  hours_actual_sum: number;
}

export interface DemandTaskCount {
  total: number;
  done: number;
  completion_pct: number;
}

const TASK_SELECT =
  "*, user_profiles!demand_tasks_assignee_id_fkey(id, full_name, email)";

export interface UserMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface TaskDetail extends Tables<"demand_tasks"> {
  assignee: UserMini | null;
  creator: UserMini | null;
  demands: {
    id: string;
    title: string;
    workspace: string;
    clients: { id: string; name: string } | null;
    ticket_columns: { name: string } | null;
  } | null;
}

export interface TimeEntryWithUser {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  hours_manual: number | null;
  description: string | null;
  created_at: string;
  user_id: string;
  task_id?: string | null;
  demand_tasks?: { id: string; title: string } | null;
  user_profiles: UserMini | null;
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task", taskId],
    enabled: !!taskId,
    staleTime: 30_000,
    queryFn: async (): Promise<TaskDetail> => {
      const { data, error } = await supabase
        .from("demand_tasks")
        .select(`
          *,
          assignee:user_profiles!demand_tasks_assignee_id_fkey(id, full_name, email),
          creator:user_profiles!demand_tasks_created_by_fkey(id, full_name, email),
          demands!demand_tasks_demand_id_fkey(
            id, title, workspace,
            clients(id, name),
            ticket_columns!demands_column_id_fkey(name)
          )
        `)
        .eq("id", taskId!)
        .single();
      if (error) throw error;
      return data as unknown as TaskDetail;
    },
  });
}

export function useTaskTimeEntries(taskId: string | undefined) {
  return useQuery({
    queryKey: ["task-time-entries", taskId],
    enabled: !!taskId,
    staleTime: 30_000,
    queryFn: async (): Promise<TimeEntryWithUser[]> => {
      const { data, error } = await supabase
        .from("demand_time_entries")
        .select(`
          id, started_at, ended_at, hours_manual, description, created_at, user_id, task_id,
          user_profiles!demand_time_entries_user_id_fkey(id, full_name, email)
        `)
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TimeEntryWithUser[];
    },
  });
}

export function useDemandTimeEntriesAll(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-time-entries-all", demandId],
    enabled: !!demandId,
    staleTime: 30_000,
    queryFn: async (): Promise<TimeEntryWithUser[]> => {
      const { data, error } = await supabase
        .from("demand_time_entries")
        .select(`
          id, started_at, ended_at, hours_manual, description, created_at, user_id, task_id,
          demand_tasks!demand_time_entries_task_id_fkey(id, title),
          user_profiles!demand_time_entries_user_id_fkey(id, full_name, email)
        `)
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TimeEntryWithUser[];
    },
  });
}

export function useDemandTasks(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-tasks", demandId],
    enabled: !!demandId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_tasks")
        .select(TASK_SELECT)
        .eq("demand_id", demandId!)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DemandTaskRow[];
    },
  });
}

export function useDemandTaskStats(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand-task-stats", demandId],
    enabled: !!demandId,
    staleTime: 15_000,
    queryFn: async (): Promise<DemandTaskStats> => {
      const { data, error } = await supabase.rpc("get_demand_task_stats", {
        p_demand_id: demandId!,
      });
      if (error) throw error;
      const stats = (data ?? {}) as Partial<DemandTaskStats>;
      return {
        total: Number(stats.total ?? 0),
        done: Number(stats.done ?? 0),
        in_progress: Number(stats.in_progress ?? 0),
        open: Number(stats.open ?? 0),
        completion_pct: Number(stats.completion_pct ?? 0),
        hours_estimated_sum: Number(stats.hours_estimated_sum ?? 0),
        hours_actual_sum: Number(stats.hours_actual_sum ?? 0),
      };
    },
  });
}

export function useDemandTaskCounts(demandIds: string[]) {
  const { user } = useAuth();
  const stableKey = [...demandIds].sort().join(",");
  return useQuery({
    queryKey: ["demand-task-counts", user?.id, stableKey],
    enabled: !!user?.id && demandIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_tasks")
        .select("demand_id, status")
        .in("demand_id", demandIds);
      if (error) throw error;
      const map: Record<string, DemandTaskCount> = {};
      for (const row of data ?? []) {
        const id = row.demand_id;
        if (!map[id]) map[id] = { total: 0, done: 0, completion_pct: 0 };
        map[id].total += 1;
        if (row.status === "done") map[id].done += 1;
      }
      for (const id of Object.keys(map)) {
        const c = map[id];
        c.completion_pct =
          c.total > 0 ? Math.round((c.done / c.total) * 1000) / 10 : 0;
      }
      return map;
    },
  });
}

interface CreateInput {
  demand_id: string;
  title: string;
  description?: string | null;
  assignee_id?: string | null;
  hours_estimated?: number | null;
  position?: number;
}

export function useCreateDemandTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateInput) => {
      const { data, error } = await supabase
        .from("demand_tasks")
        .insert({
          demand_id: input.demand_id,
          title: input.title,
          description: input.description ?? null,
          assignee_id: input.assignee_id ?? null,
          hours_estimated: input.hours_estimated ?? null,
          status: "open",
          position: input.position ?? 0,
          created_by: user?.id ?? null,
        })
        .select("id, demand_id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["demand-tasks", data.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demand-task-stats", data.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demand-task-counts"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao criar subdemanda"),
  });
}

interface UpdateInput {
  id: string;
  demand_id: string;
  title?: string;
  description?: string | null;
  assignee_id?: string | null;
  hours_estimated?: number | null;
  hours_actual?: number | null;
  status?: DemandTaskStatus;
  position?: number;
}

export function useUpdateDemandTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInput) => {
      const { id, demand_id: _demandId, ...fields } = input;
      const { error } = await supabase.from("demand_tasks").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand-tasks", vars.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demand-task-stats", vars.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demand-task-counts"] });
      queryClient.invalidateQueries({ queryKey: ["demand", vars.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar subdemanda"),
  });
}

interface DeleteInput {
  id: string;
  demand_id: string;
}

export function useDeleteDemandTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteInput) => {
      const { error } = await supabase.from("demand_tasks").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand-tasks", vars.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demand-task-stats", vars.demand_id] });
      queryClient.invalidateQueries({ queryKey: ["demand-task-counts"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao excluir subdemanda"),
  });
}

interface ReorderInput {
  demand_id: string;
  items: Array<{ id: string; position: number }>;
}

export function useReorderDemandTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReorderInput) => {
      const updates = await Promise.all(
        input.items.map((it) =>
          supabase.from("demand_tasks").update({ position: it.position }).eq("id", it.id),
        ),
      );
      const firstError = updates.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand-tasks", vars.demand_id] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao reordenar subdemandas"),
  });
}
