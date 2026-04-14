import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationWithStatus {
  conversation_id: string;
  contact_name: string | null;
  last_message: string | null;
  last_sender_side: string | null;
  last_occurred_at: string;
  total_messages: number;
  worst_tone: string;
  status: "sem_resposta" | "em_andamento" | "inativo";
}

export function useClientConversationsStatus(clientId: string | undefined) {
  return useQuery<ConversationWithStatus[]>({
    queryKey: ["client_conversations_status", clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_client_conversations_with_status", { p_client_id: clientId! });
      if (error) throw error;
      return (data ?? []) as ConversationWithStatus[];
    },
  });
}
