import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export interface DemandTimeEntry extends Tables<"demand_time_entries"> {
  user_profiles?: { full_name: string | null; email: string | null } | null;
}

export interface UserActiveTimer {
  id: string;
  demand_id: string;
  demand_title: string | null;
  started_at: string;
}

export function useDemandTimeEntries(demandId: string | undefined) {
  const { user } = useAuth();
  return useQuery<DemandTimeEntry[]>({
    queryKey: ["demand-time-entries", user?.id, demandId],
    enabled: !!demandId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_time_entries")
        .select("*, user_profiles(full_name, email)")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DemandTimeEntry[];
    },
  });
}

export function useActiveTimerEntry(demandId: string | undefined) {
  const { user } = useAuth();
  return useQuery<DemandTimeEntry | null>({
    queryKey: ["demand-active-timer", user?.id, demandId],
    enabled: !!demandId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_time_entries")
        .select("*")
        .eq("demand_id", demandId!)
        .eq("user_id", user!.id)
        .is("ended_at", null)
        .not("started_at", "is", null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DemandTimeEntry | null;
    },
  });
}

export function useUserActiveTimer() {
  const { user } = useAuth();
  return useQuery<UserActiveTimer | null>({
    queryKey: ["user-active-timer", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_time_entries")
        .select("id, demand_id, started_at, demands(title)")
        .eq("user_id", user!.id)
        .is("ended_at", null)
        .not("started_at", "is", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const demands = data.demands as unknown as { title: string | null } | null;
      return {
        id: data.id,
        demand_id: data.demand_id,
        demand_title: demands?.title ?? null,
        started_at: data.started_at as string,
      };
    },
  });
}

export function useDemandTotalHours(demandId: string | undefined) {
  return useQuery<number>({
    queryKey: ["demand-total-hours", demandId],
    enabled: !!demandId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_demand_total_hours", { p_demand_id: demandId! });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["demand-time-entries"] });
  qc.invalidateQueries({ queryKey: ["demand-active-timer"] });
  qc.invalidateQueries({ queryKey: ["user-active-timer"] });
  qc.invalidateQueries({ queryKey: ["demand-total-hours"] });
  qc.invalidateQueries({ queryKey: ["demands"] });
  qc.invalidateQueries({ queryKey: ["demand"] });
}

export function useStartTimer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId }: { demandId: string }) => {
      if (!user?.id) throw new Error("Não autenticado");

      // Global guard: block if any active timer exists for this user
      const { data: existing, error: checkErr } = await supabase
        .from("demand_time_entries")
        .select("id, demand_id, demands(title)")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .not("started_at", "is", null)
        .maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) {
        const demands = existing.demands as unknown as { title: string | null } | null;
        throw new Error(
          `Você já tem um timer ativo em "${demands?.title ?? "outra demanda"}". Finalize antes de iniciar um novo.`
        );
      }

      const { data, error } = await supabase
        .from("demand_time_entries")
        .insert({
          demand_id: demandId,
          user_id: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new Error("Você já tem um timer ativo em outra demanda.");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Timer iniciado");
      invalidateAll(qc);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao iniciar timer"),
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      const { error } = await supabase
        .from("demand_time_entries")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Timer finalizado");
      invalidateAll(qc);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao finalizar timer"),
  });
}

export function useAddManualEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demandId,
      hours,
      description,
    }: {
      demandId: string;
      hours: number;
      description?: string;
    }) => {
      if (!user?.id) throw new Error("Não autenticado");
      if (!hours || hours <= 0) throw new Error("Informe um número de horas válido");
      const { error } = await supabase.from("demand_time_entries").insert({
        demand_id: demandId,
        user_id: user.id,
        hours_manual: hours,
        description: description?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tempo registrado");
      invalidateAll(qc);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao registrar tempo"),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId }: { entryId: string }) => {
      const { error } = await supabase.from("demand_time_entries").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrada removida");
      invalidateAll(qc);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao remover entrada"),
  });
}

/**
 * Compute total hours for an entry (used in lists).
 */
export function entryHours(entry: DemandTimeEntry): number {
  if (entry.hours_manual != null) return Number(entry.hours_manual);
  if (entry.started_at && entry.ended_at) {
    const ms = new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
    return Math.max(0, ms / 3_600_000);
  }
  return 0;
}
