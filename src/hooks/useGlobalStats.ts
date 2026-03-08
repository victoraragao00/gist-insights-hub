import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface ToneMonth {
  mes: string;
  ok: number;
  atencao: number;
  alerta: number;
  critico: number;
}

export interface ThemeCount {
  theme: string;
  count: number;
}

export interface GlobalStats {
  total_interactions_30d: number;
  pct_critico: number;
  pct_alerta: number;
  total_clients_monitored: number;
  last_calculated_at: string;
  monthly_tone_evolution: ToneMonth[];
  top_themes: ThemeCount[];
}

export function useGlobalStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["global-stats", user?.id],
    queryFn: async (): Promise<GlobalStats | null> => {
      const { data, error } = await supabase.rpc("global_stats_30d", {
        p_user_id: user!.id,
      });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const row = data[0] as Record<string, unknown>;
      return {
        total_interactions_30d: Number(row.total_interactions_30d ?? 0),
        pct_critico: Number(row.pct_critico ?? 0),
        pct_alerta: Number(row.pct_alerta ?? 0),
        total_clients_monitored: Number(row.total_clients_monitored ?? 0),
        last_calculated_at: String(row.last_calculated_at ?? ""),
        monthly_tone_evolution: (row.monthly_tone_evolution ?? []) as ToneMonth[],
        top_themes: (row.top_themes ?? []) as ThemeCount[],
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
}
