import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConversationSummary {
  id: string;
  demand_id: string;
  conversation_id: string;
  summary: string;
  generated_at: string;
  created_by: string | null;
}

export function useConversationSummaries(demandId: string | undefined) {
  return useQuery<ConversationSummary[]>({
    queryKey: ["conv_summaries", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_conversation_summaries")
        .select("*")
        .eq("demand_id", demandId!)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConversationSummary[];
    },
  });
}

export function useSummarizeConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demand_id,
      conversation_id,
    }: {
      demand_id: string;
      conversation_id: string;
    }) => {
      const { data: funcData, error: funcError } = await supabase.functions.invoke(
        "summarize-conversation",
        { body: { demand_id, conversation_id } }
      );
      if (funcError) throw funcError;
      if (funcData?.error) throw new Error(funcData.error);
      return funcData as { summary: string; generated_at: string };
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["conv_summaries", vars.demand_id] });
      toast.success("Resumo gerado com sucesso");
    },
    onError: (err) => {
      toast.error("Erro ao gerar resumo: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
