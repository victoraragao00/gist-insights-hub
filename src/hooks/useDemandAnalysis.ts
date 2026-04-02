import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useDemandAnalysis(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand_analysis", demandId],
    enabled: !!demandId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_ai_analyses")
        .select("*")
        .eq("demand_id", demandId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useAnalyzeDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (demandId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-demand`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ demand_id: demandId }),
        }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errData.error || "Erro ao analisar demanda");
      }
      return response.json();
    },
    onSuccess: (_data, demandId) => {
      queryClient.invalidateQueries({ queryKey: ["demand_analysis", demandId] });
      toast.success("Análise gerada com sucesso");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao analisar");
    },
  });
}
