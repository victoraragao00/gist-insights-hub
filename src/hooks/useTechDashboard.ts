import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface AlertItemSimple {
  id: string;
  title: string;
  days?: number;
  wip_count?: number;
  user_id?: string;
  name?: string;
  email?: string;
}

export interface DeliveredByArea {
  area_id: string | null;
  area_name: string | null;
  count: number;
}

export interface TechDashboardData {
  is_admin: boolean;
  alerts: {
    blocked: { count: number; items?: AlertItemSimple[] };
    overloaded: { count: number; items?: AlertItemSimple[] };
    forgotten: { count: number; items?: AlertItemSimple[] };
    delivered: {
      count_current: number;
      count_previous?: number;
      by_area?: DeliveredByArea[];
    };
  };
  throughput: Array<{ week_label: string; done: number; created: number }>;
  cycle_time: {
    p50_cycle: number | null;
    p85_cycle: number | null;
    avg_lead: number | null;
    reopen_count: number;
    distribution?: Array<{ bucket: string; count: number }>;
  };
  column_time: Array<{ column_id: string; column_name: string; avg_days: number }>;
  people: Array<{
    user_id: string;
    name: string | null;
    email: string | null;
    wip_count: number;
    hours_period: number;
    delivered_period: number;
  }>;
  forecast: {
    backlog_count: number;
    avg_throughput: number;
    weeks_optimist: number | null;
    weeks_probable: number | null;
    weeks_conservative: number | null;
  } | null;
  hours: {
    total_estimated: number;
    total_actual: number;
    by_area?: Array<{
      area_id: string;
      area_name: string;
      estimated: number;
      actual: number;
    }>;
  } | null;
}

export function useTechDashboard(
  periodDays: number,
  areaId?: string,
  projectId?: string,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tech-dashboard", user?.id, periodDays, areaId ?? null, projectId ?? null],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tech_dashboard_metrics", {
        p_period_days: periodDays,
        p_area_id: areaId ?? null,
        p_project_id: projectId ?? null,
      });
      if (error) throw error;
      return data as unknown as TechDashboardData;
    },
  });
}
