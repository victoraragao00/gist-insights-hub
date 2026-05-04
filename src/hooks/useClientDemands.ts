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

export interface ClientDemandsResult {
  demands: ClientDemand[];
  totalCount: number;
  openCount: number;
  completedCount: number;
  blockedCount: number;
}

export function useClientDemands(clientId: string | undefined) {
  return useQuery<ClientDemandsResult>({
    queryKey: ["client_demands", clientId],
    staleTime: 30_000,
    enabled: !!clientId,
    queryFn: async () => {
      const id = clientId!;

      const [
        totalRes,
        openRes,
        completedRes,
        blockedRes,
        listRes,
      ] = await Promise.all([
        supabase
          .from("demands")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id),
        supabase
          .from("demands")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id)
          .is("finished_at", null)
          .is("cancellation_reason", null),
        supabase
          .from("demands")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id)
          .not("finished_at", "is", null)
          .is("cancellation_reason", null),
        supabase
          .from("demands")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id)
          .eq("is_blocked", true),
        supabase
          .from("demands")
          .select(
            `*,
             clients(id, name),
             demand_types(id, name, color, icon),
             ticket_columns(id, name, color, triggers_started_at, triggers_finished_at),
             demand_areas(id, name, color),
             user_profiles!assignee_id(id, full_name, email)`
          )
          .eq("client_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (totalRes.error) throw totalRes.error;
      if (openRes.error) throw openRes.error;
      if (completedRes.error) throw completedRes.error;
      if (blockedRes.error) throw blockedRes.error;
      if (listRes.error) throw listRes.error;

      return {
        demands: (listRes.data ?? []) as ClientDemand[],
        totalCount: totalRes.count ?? 0,
        openCount: openRes.count ?? 0,
        completedCount: completedRes.count ?? 0,
        blockedCount: blockedRes.count ?? 0,
      };
    },
  });
}
