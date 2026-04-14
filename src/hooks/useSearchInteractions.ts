import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface SearchResult {
  id: string;
  client_name: string;
  sender_raw: string;
  sender_side: string;
  body: string;
  tone: string;
  theme: string;
  occurred_at: string;
  total_count: number;
}

export interface SearchParams {
  query: string;
  clientId?: string;
  tone?: string;
  page?: number;
  limit?: number;
}

export function useSearchInteractions(params: SearchParams) {
  const { user } = useAuth();
  const { query, clientId, tone, page = 0, limit = 20 } = params;

  return useQuery({
    queryKey: ["search-interactions", user?.id, query, clientId, tone, page, limit],
    queryFn: async (): Promise<SearchResult[]> => {
      const { data, error } = await supabase.rpc("search_interactions", {
        p_user_id: user!.id,
        p_query: query,
        p_client_id: clientId || null,
        p_tone: tone || null,
        p_limit: limit,
        p_offset: page * limit,
      });
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
    enabled: !!user?.id && query.length >= 3,
    staleTime: 30_000,
  });
}
