import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GistKPIs {
  totalContacts: number;
  openConversations: number;
  closedConversations: number;
  totalTags: number;
  teammatesOnline: number;
  totalTeammates: number;
  activeSegments: number;
}

async function fetchGistEndpoint(endpoint: string, params?: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke("gist-proxy", {
    body: { endpoint, params },
  });
  if (error) throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
  return data;
}

async function fetchGistKPIs(): Promise<GistKPIs> {
  const [contacts, openConvos, closedConvos, tags, teammates, segments] =
    await Promise.all([
      fetchGistEndpoint("contacts", { per_page: "1" }),
      fetchGistEndpoint("conversations", { state: "open", per_page: "1" }),
      fetchGistEndpoint("conversations", { state: "closed", per_page: "1" }),
      fetchGistEndpoint("tags"),
      fetchGistEndpoint("teammates"),
      fetchGistEndpoint("segments"),
    ]);

  const teamList = teammates?.teammates ?? teammates ?? [];
  const onlineCount = Array.isArray(teamList)
    ? teamList.filter((t: any) => !t.away_mode_enabled).length
    : 0;

  return {
    totalContacts: contacts?.pages?.total_count ?? 0,
    openConversations: openConvos?.pages?.total_count ?? 0,
    closedConversations: closedConvos?.pages?.total_count ?? 0,
    totalTags: Array.isArray(tags?.tags) ? tags.tags.length : Array.isArray(tags) ? tags.length : 0,
    teammatesOnline: onlineCount,
    totalTeammates: Array.isArray(teamList) ? teamList.length : 0,
    activeSegments: Array.isArray(segments?.segments) ? segments.segments.length : Array.isArray(segments) ? segments.length : 0,
  };
}

export function useGistKPIs() {
  return useQuery({
    queryKey: ["gist-kpis"],
    queryFn: fetchGistKPIs,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
