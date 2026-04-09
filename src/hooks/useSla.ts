import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface DemandWithSla {
  id: string;
  title: string;
  priority: string;
  client_id: string;
  client_name: string;
  column_id: string;
  column_name: string;
  assignee_name: string | null;
  created_at: string;
  sla_first_response_at: string | null;
  sla_hours_limit: number;
  sla_elapsed_hours: number;
  sla_remaining_hours: number;
  sla_percent_used: number;
  sla_status: "ok" | "em_risco" | "vencido";
  is_blocked: boolean;
  cancellation_reason: string | null;
}

export function useSlaDemandsBoard() {
  const { user } = useAuth();
  return useQuery<DemandWithSla[]>({
    queryKey: ["sla_demands", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_demands_with_sla", {
        p_user_id: user!.id,
      });
      if (error) throw error;
      return (data ?? []) as unknown as DemandWithSla[];
    },
  });
}
