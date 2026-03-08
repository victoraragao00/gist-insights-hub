import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface AuditAlert {
  id: string;
  client_name: string;
  metric: string;
  metric_value: number;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AuditAlertsSummary {
  total_alerts_30d: number;
  unread_count: number;
  alerts: AuditAlert[];
}

export function useAuditAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["audit-alerts-summary", user?.id],
    queryFn: async (): Promise<AuditAlertsSummary | null> => {
      const { data, error } = await supabase.rpc("audit_alerts_summary", {
        p_user_id: user!.id,
      });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const row = data[0] as Record<string, unknown>;
      return {
        total_alerts_30d: Number(row.total_alerts_30d ?? 0),
        unread_count: Number(row.unread_count ?? 0),
        alerts: (row.alerts ?? []) as AuditAlert[],
      };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}
