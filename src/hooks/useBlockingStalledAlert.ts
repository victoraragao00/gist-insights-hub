import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlockingStalledItem {
  id: string;
  title: string;
  days_stalled: number;
  blocks_count: number;
}

export interface BlockingStalledData {
  count: number;
  items: BlockingStalledItem[];
}

/**
 * Returns TECH demands that:
 * - are open (not finished, not cancelled)
 * - have not been updated for >= 3 days
 * - act as predecessor in at least one `blocks` relationship
 */
export function useBlockingStalledAlert(enabled = true) {
  return useQuery({
    queryKey: ["blocking-stalled"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<BlockingStalledData> => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Fetch all "blocks" relationships and group predecessor counts.
      const { data: rels, error: relsErr } = await supabase
        .from("demand_relationships")
        .select("demand_id")
        .eq("relationship_type", "blocks");
      if (relsErr) throw relsErr;

      const blocksCount = new Map<string, number>();
      for (const r of rels ?? []) {
        blocksCount.set(r.demand_id, (blocksCount.get(r.demand_id) ?? 0) + 1);
      }
      const predecessorIds = Array.from(blocksCount.keys());
      if (predecessorIds.length === 0) return { count: 0, items: [] };

      // 2. Fetch open TECH demands stalled >= 3d that match.
      const { data: demands, error: dErr } = await supabase
        .from("demands")
        .select("id, title, last_updated")
        .eq("workspace", "tech")
        .is("finished_at", null)
        .is("cancellation_reason", null)
        .lt("last_updated", threeDaysAgo)
        .in("id", predecessorIds);
      if (dErr) throw dErr;

      const items: BlockingStalledItem[] = (demands ?? []).map((d) => {
        const days = d.last_updated
          ? Math.floor((Date.now() - new Date(d.last_updated).getTime()) / 86_400_000)
          : 0;
        return {
          id: d.id,
          title: d.title,
          days_stalled: days,
          blocks_count: blocksCount.get(d.id) ?? 0,
        };
      });
      items.sort((a, b) => b.days_stalled - a.days_stalled);
      return { count: items.length, items };
    },
  });
}
