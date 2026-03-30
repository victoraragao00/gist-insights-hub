import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface DemandAnalyticsTotals {
  total: number;
  open: number;
  completed: number;
  blocked: number;
  avg_lead_time_hours: number | null;
  avg_cycle_time_hours: number | null;
}

export interface DemandAnalyticsByItem {
  name: string;
  color?: string | null;
  total: number;
}

export interface DemandAnalyticsByPriority {
  priority: string;
  total: number;
}

export interface DemandAnalyticsWeekly {
  week: string;
  total: number;
}

export interface DemandAnalyticsData {
  totals: DemandAnalyticsTotals;
  by_type: DemandAnalyticsByItem[];
  by_priority: DemandAnalyticsByPriority[];
  by_column: DemandAnalyticsByItem[];
  by_area: DemandAnalyticsByItem[];
  weekly_trend: DemandAnalyticsWeekly[];
}

export function useDemandAnalytics(clientId?: string | null, days: number = 30) {
  const { user } = useAuth();

  return useQuery<DemandAnalyticsData>({
    queryKey: ["demand_analytics", user?.id, clientId ?? "all", days],
    enabled: !!user?.id,
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_demand_analytics", {
        p_client_id: clientId ?? null,
        p_days: days,
      });
      if (error) throw error;

      const result = data as DemandAnalyticsData;
      return {
        totals: result.totals ?? {
          total: 0, open: 0, completed: 0, blocked: 0,
          avg_lead_time_hours: null, avg_cycle_time_hours: null,
        },
        by_type: result.by_type ?? [],
        by_priority: result.by_priority ?? [],
        by_column: result.by_column ?? [],
        by_area: result.by_area ?? [],
        weekly_trend: result.weekly_trend ?? [],
      };
    },
  });
}
