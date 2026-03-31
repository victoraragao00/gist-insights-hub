import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface DemandWatcher {
  id: string;
  demand_id: string;
  user_id: string;
  created_at: string | null;
  full_name: string | null;
  email: string | null;
}

export function useDemandWatchers(demandId: string | undefined) {
  const { user } = useAuth();

  return useQuery<DemandWatcher[]>({
    queryKey: ["demand_watchers", user?.id, demandId],
    enabled: !!demandId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_watchers")
        .select("id, demand_id, user_id, created_at, user_profiles(full_name, email)")
        .eq("demand_id", demandId!)
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const profile = row.user_profiles as unknown as { full_name: string | null; email: string | null } | null;
        return {
          id: row.id,
          demand_id: row.demand_id,
          user_id: row.user_id,
          created_at: row.created_at,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
        };
      });
    },
  });
}

export function useToggleWatcher(demandId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (isWatching: boolean) => {
      if (!user?.id) throw new Error("Não autenticado");

      if (isWatching) {
        const { error } = await supabase
          .from("demand_watchers")
          .delete()
          .eq("demand_id", demandId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("demand_watchers")
          .insert({ demand_id: demandId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_data, isWatching) => {
      toast.success(isWatching ? "Você parou de observar esta demanda" : "Você está observando esta demanda");
      queryClient.invalidateQueries({ queryKey: ["demand_watchers"] });
    },
    onError: (err) => {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
