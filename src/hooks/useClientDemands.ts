import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface ClientDemand extends Tables<"demands"> {
  clients?: { id: string; name: string } | null;
  demand_types?: { id: string; name: string; color: string | null; icon: string | null } | null;
  ticket_columns?: { id: string; name: string; color: string | null; triggers_started_at: boolean | null; triggers_finished_at: boolean | null } | null;
  demand_areas?: { id: string; name: string; color: string | null } | null;
  user_profiles?: { id: string; full_name: string | null; email: string | null } | null;
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
          `*,
           clients(id, name),
           demand_types(id, name, color, icon),
           ticket_columns(id, name, color, triggers_started_at, triggers_finished_at),
           demand_areas(id, name, color),
           user_profiles!assignee_id(id, full_name, email)`
        )
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ClientDemand[];
    },
  });
}
