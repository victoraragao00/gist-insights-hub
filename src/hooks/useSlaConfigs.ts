import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SlaConfig {
  id: string;
  client_id: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  hours_limit: number;
}

export function useSlaConfigs(clientId?: string) {
  return useQuery<SlaConfig[]>({
    queryKey: ["sla_configs", clientId ?? "global"],
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase
        .from("sla_configs")
        .select("id, client_id, priority, hours_limit")
        .order("priority");

      if (clientId) {
        query = query.or(`client_id.eq.${clientId},client_id.is.null`);
      } else {
        query = query.is("client_id", null);
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
    mutationFn: async (config: { client_id: string | null; priority: string; hours_limit: number }) => {
      const { error } = await supabase
        .from("sla_configs")
        .upsert(
          { client_id: config.client_id, priority: config.priority, hours_limit: config.hours_limit, updated_at: new Date().toISOString() },
          { onConflict: "client_id,priority" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_configs"] });
      toast.success("SLA atualizado");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useResetSlaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, priority }: { clientId: string; priority: string }) => {
      const { error } = await supabase
        .from("sla_configs")
        .delete()
        .eq("client_id", clientId)
        .eq("priority", priority);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla_configs"] });
      toast.success("SLA resetado para o padrão global");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
