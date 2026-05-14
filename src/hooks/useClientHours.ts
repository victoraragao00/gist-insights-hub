import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface ClientHoursDemandRef {
  id: string;
  title: string;
  hours: number;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface ClientHoursProject {
  project_id: string;
  project_name: string;
  hours: number;
  demand_count: number;
  demands: ClientHoursDemandRef[];
}

export interface ClientHoursBreakdown {
  client_id: string;
  total_hours: number;
  avulsas: {
    hours: number;
    demand_count: number;
    demands: ClientHoursDemandRef[];
  };
  projetos: ClientHoursProject[];
}

export function useClientHours(clientId: string | undefined) {
  const { user } = useAuth();
  return useQuery<ClientHoursBreakdown | null>({
    queryKey: ["client-hours", user?.id, clientId],
    enabled: !!user?.id && !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_hours_breakdown", {
        p_client_id: clientId!,
      });
      if (error) throw error;
      return (data as unknown as ClientHoursBreakdown) ?? null;
    },
  });
}
