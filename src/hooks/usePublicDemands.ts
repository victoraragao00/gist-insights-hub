import { useQuery } from "@tanstack/react-query";

export interface PublicDemand {
  id: string;
  title: string;
  priority: string;
  type: string;
  column: string;
  area: string | null;
  assignee: string | null;
  is_blocked: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface PublicDemandsData {
  client: { name: string };
  totals: {
    total: number;
    open: number;
    completed: number;
    blocked: number;
  };
  demands: PublicDemand[];
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function usePublicDemands(token: string | undefined) {
  return useQuery<PublicDemandsData>({
    queryKey: ["public_demands", token],
    enabled: !!token,
    staleTime: 60_000,
    queryFn: async () => {
      const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/client-demands-public?token=${encodeURIComponent(token!)}`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Erro ao carregar dados");
      }
      return data as PublicDemandsData;
    },
  });
}
