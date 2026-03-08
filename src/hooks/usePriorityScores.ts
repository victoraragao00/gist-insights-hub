import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type ClientTier = "azzas" | "enterprise" | "medium" | "small";

export interface PriorityPattern {
  type?: string;
  theme?: string;
  user_count?: number;
  window_days?: number;
  severity?: "high" | "medium" | "low";
  worst_tone?: string;
  description?: string;
}

export interface PriorityScoreRow {
  id: string;
  client_id: string;
  score: number;
  patterns: PriorityPattern[];
  calculated_at: string;
  client_name: string;
  client_slug: string;
  tier: ClientTier;
}

export function usePriorityScores() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["priority-scores", user?.id],
    queryFn: async (): Promise<PriorityScoreRow[]> => {
      const [scoresRes, configsRes] = await Promise.all([
        supabase
          .from("priority_scores")
          .select("id, client_id, score, patterns, calculated_at, clients(name, slug)")
          .order("score", { ascending: false }),
        supabase
          .from("client_priority_config")
          .select("client_id, tier")
          .eq("active", true),
      ]);
      if (scoresRes.error) throw scoresRes.error;
      if (configsRes.error) throw configsRes.error;

      const scores = scoresRes.data ?? [];
      const configs = configsRes.data ?? [];
      const tierByClient = new Map<string, ClientTier>();
      configs.forEach((c) => tierByClient.set(c.client_id, c.tier as ClientTier));

      return scores.map((row) => {
        const clients = row.clients as { name: string; slug: string } | null;
        return {
          id: row.id,
          client_id: row.client_id,
          score: row.score,
          patterns: (row.patterns as PriorityPattern[]) ?? [],
          calculated_at: row.calculated_at,
          client_name: clients?.name ?? "—",
          client_slug: clients?.slug ?? "",
          tier: tierByClient.get(row.client_id) ?? "medium",
        };
      });
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  return query;
}
