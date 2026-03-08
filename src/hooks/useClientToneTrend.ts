import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface ToneTrendDay {
  day: string;
  ok: number;
  atencao: number;
  alerta: number;
  critico: number;
}

export function useClientToneTrend(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-tone-trend", user?.id, clientId],
    queryFn: async (): Promise<ToneTrendDay[]> => {
      const { data, error } = await supabase.rpc("client_tone_trend_7d", {
        p_user_id: user!.id,
        p_client_id: clientId!,
      });
      if (error) throw error;
      return (data ?? []) as ToneTrendDay[];
    },
    enabled: !!user?.id && !!clientId,
    staleTime: 5 * 60_000,
  });
}
