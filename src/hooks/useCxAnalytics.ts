import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface CxAnalyticsData {
  period_days: number;
  throughput: {
    weekly: Array<{ week_label: string; done: number; created: number }>;
    total_done: number;
    total_created: number;
    delivery_rate: number;
  };
  cycle_time: {
    p50_cycle: number | null;
    p85_cycle: number | null;
    avg_lead: number | null;
    reopen_count: number;
    distribution?: Array<{ bucket: string; count: number }>;
  };
  column_time: Array<{
    column_id: string;
    column_name: string;
    avg_days: number;
    p85_days?: number | null;
  }>;
  people: Array<{
    user_id: string;
    name: string | null;
    email: string | null;
    wip_count: number;
    hours_period: number;
    delivered_period: number;
  }>;
}

interface RawPerson {
  user_id: string;
  name: string | null;
  email: string | null;
  wip_count: number;
  delivered_period: number;
}

export function useCxAnalytics(periodDays: number, clientId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cx-analytics", user?.id, periodDays, clientId ?? "all"],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<CxAnalyticsData> => {
      const { data, error } = await supabase.rpc("get_cx_analytics_metrics", {
        p_period_days: periodDays,
        p_client_id: clientId ?? null,
      });
      if (error) throw error;

      const raw = data as unknown as Omit<CxAnalyticsData, "people" | "cycle_time"> & {
        people: RawPerson[];
        cycle_time: Omit<CxAnalyticsData["cycle_time"], "reopen_count">;
      };

      return {
        ...raw,
        cycle_time: { ...raw.cycle_time, reopen_count: 0 },
        people: (raw.people ?? []).map((p) => ({ ...p, hours_period: 0 })),
      };
    },
  });
}
