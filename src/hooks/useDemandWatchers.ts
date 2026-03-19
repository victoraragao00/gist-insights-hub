import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface DemandWatcher {
  id: string;
  demand_id: string;
  user_id: string;
  created_at: string | null;
}

export function useDemandWatchers(demandId: string | undefined) {
  const { user } = useAuth();

  return useQuery<DemandWatcher[]>({
    queryKey: ["demand_watchers", demandId],
    enabled: !!demandId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_watchers")
        .select("*")
        .eq("demand_id", demandId!)
        .limit(100);
      if (error) throw error;
      return (data ?? []) as DemandWatcher[];
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
      queryClient.invalidateQueries({ queryKey: ["demand_watchers", demandId] });
    },
    onError: (err) => {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
