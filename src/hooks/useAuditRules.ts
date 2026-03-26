import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface AuditRule {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null;
  metric: string;
  operator: string;
  threshold: number;
  window_hours: number | null;
  alert_channel: "email" | "whatsapp" | "both" | null;
  alert_recipients: string[];
  cooldown_hours: number | null;
  active: boolean | null;
  created_at: string | null;
}

interface UseAuditRulesParams {
  page?: number;
  limit?: number;
}

export function useAuditRules(params: UseAuditRulesParams = {}) {
  const { user } = useAuth();
  const { page = 0, limit = 20 } = params;

  return useQuery<{ rules: AuditRule[]; totalCount: number }>({
    queryKey: ["audit-rules", user?.id, page],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const from = page * limit;
      const to = (page + 1) * limit - 1;
      const { data, error, count } = await supabase
        .from("audit_rules")
        .select("*, clients(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rules: AuditRule[] = (data ?? []).map((row: Record<string, unknown>) => {
        const { clients, ...rest } = row;
        return {
          ...rest,
          client_name: (clients as { name: string } | null)?.name ?? null,
        } as AuditRule;
      });
      return { rules, totalCount: count ?? 0 };
    },
  });
}
