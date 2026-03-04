import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GistTeammateResponse {
  id: number;
  name: string;
  email: string;
  away_mode_enabled: boolean;
}

interface GistPaginatedResponse {
  pages?: { total_count: number };
}

interface GistTagsResponse {
  tags?: Array<{ id: number; name: string }>;
}

interface GistTeammatesResponse {
  teammates?: GistTeammateResponse[];
}

interface GistSegmentsResponse {
  segments?: Array<{ id: number; name: string }>;
}

interface GistKPIs {
  totalContacts: number;
  openConversations: number;
  closedConversations: number;
  totalTags: number;
  teammatesOnline: number;
  totalTeammates: number;
  activeSegments: number;
}

async function fetchGistEndpoint<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("gist-proxy", {
    body: { endpoint, params },
  });
  if (error) throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
  return data as T;
}

async function fetchGistKPIs(): Promise<GistKPIs> {
  const [contacts, openConvos, closedConvos, tags, teammates, segments] =
    await Promise.all([
      fetchGistEndpoint<GistPaginatedResponse>("contacts", { per_page: "1" }),
      fetchGistEndpoint<GistPaginatedResponse>("conversations", { state: "open", per_page: "1" }),
      fetchGistEndpoint<GistPaginatedResponse>("conversations", { state: "closed", per_page: "1" }),
      fetchGistEndpoint<GistTagsResponse>("tags"),
      fetchGistEndpoint<GistTeammatesResponse>("teammates"),
      fetchGistEndpoint<GistSegmentsResponse>("segments"),
    ]);

  const teamList: GistTeammateResponse[] = teammates?.teammates ?? [];
  const onlineCount = teamList.filter((t) => !t.away_mode_enabled).length;

  return {
    totalContacts: contacts?.pages?.total_count ?? 0,
    openConversations: openConvos?.pages?.total_count ?? 0,
    closedConversations: closedConvos?.pages?.total_count ?? 0,
    totalTags: Array.isArray(tags?.tags) ? tags.tags.length : 0,
    teammatesOnline: onlineCount,
    totalTeammates: teamList.length,
    activeSegments: Array.isArray(segments?.segments) ? segments.segments.length : 0,
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
