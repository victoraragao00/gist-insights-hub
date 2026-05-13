import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SlaConfig {
  id: string;
  client_id: string | null;
  demand_type_id: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  hours_limit: number;
  enabled: boolean;
}

/**
 * Reads SLA configs.
 * - clientId undefined => only globals (client_id IS NULL)
 * - clientId set       => globals + that client's
 * - demandTypeId undefined => no filter on type
 * - demandTypeId null     => only "Todos os tipos" (demand_type_id IS NULL)
 * - demandTypeId set      => only that type
 */
export function useSlaConfigs(clientId?: string, demandTypeId?: string | null) {
  return useQuery<SlaConfig[]>({
    queryKey: ["sla_configs", clientId ?? "global", demandTypeId === undefined ? "any" : demandTypeId ?? "null"],
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase
        .from("sla_configs")
        .select("id, client_id, demand_type_id, priority, hours_limit, enabled")
        .order("priority");

      if (clientId) {
        query = query.or(`client_id.eq.${clientId},client_id.is.null`);
      } else {
        query = query.is("client_id", null);
      }

      if (demandTypeId === null) {
        query = query.is("demand_type_id", null);
      } else if (demandTypeId) {
        query = query.eq("demand_type_id", demandTypeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SlaConfig[];
    },
  });
}

export function useUpsertSlaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: {
      client_id: string | null;
      demand_type_id: string | null;
      priority: string;
      hours_limit: number;
      enabled?: boolean;
    }) => {
      // We can't use onConflict because the unique key uses COALESCE expression.
      // Look up existing row first.
      let lookup = supabase
        .from("sla_configs")
        .select("id")
        .eq("priority", config.priority);
      lookup = config.client_id
        ? lookup.eq("client_id", config.client_id)
        : lookup.is("client_id", null);
      lookup = config.demand_type_id
        ? lookup.eq("demand_type_id", config.demand_type_id)
        : lookup.is("demand_type_id", null);

      const { data: existing, error: selErr } = await lookup.maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error } = await supabase
          .from("sla_configs")
          .update({
            hours_limit: config.hours_limit,
            enabled: config.enabled ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sla_configs").insert({
          client_id: config.client_id,
          demand_type_id: config.demand_type_id,
          priority: config.priority,
          hours_limit: config.hours_limit,
          enabled: config.enabled ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_configs"] });
      queryClient.invalidateQueries({ queryKey: ["sla_demands"] });
      toast.success("SLA atualizado");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useResetSlaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      demandTypeId,
      priority,
    }: {
      clientId: string | null;
      demandTypeId: string | null;
      priority: string;
    }) => {
      let q = supabase.from("sla_configs").delete().eq("priority", priority);
      q = clientId ? q.eq("client_id", clientId) : q.is("client_id", null);
      q = demandTypeId ? q.eq("demand_type_id", demandTypeId) : q.is("demand_type_id", null);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_configs"] });
      queryClient.invalidateQueries({ queryKey: ["sla_demands"] });
      toast.success("SLA resetado");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
