import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientDemand {
  id: string;
  title: string;
  priority: string;
  is_blocked: boolean | null;
  created_at: string | null;
  demand_types: { name: string; color: string | null; icon: string | null } | null;
  ticket_columns: { name: string; color: string | null; triggers_finished_at: boolean | null } | null;
  demand_areas: { name: string; color: string | null } | null;
  demand_assignees: { name: string } | null;
}

export function useClientDemands(clientId: string | undefined) {
  return useQuery<ClientDemand[]>({
    queryKey: ["client_demands", clientId],
    staleTime: 30_000,
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select(
          `id, title, priority, is_blocked, created_at,
           demand_types(name, color, icon),
           ticket_columns(name, color, triggers_finished_at),
           demand_areas(name, color),
           user_profiles!assignee_id(full_name, email)`
        )
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ClientDemand[];
    },
  });
}
