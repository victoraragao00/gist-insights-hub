import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationMessage {
  id: string;
  content: string | null;
  sender_raw: string | null;
  sender_side: string | null;
  occurred_at: string;
  tone: string | null;
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery<ConversationMessage[]>({
    queryKey: ["conversation_messages", conversationId],
    enabled: !!conversationId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("id, content, sender_raw, sender_side, occurred_at, tone")
        .eq("conversation_id", conversationId!)
        .order("occurred_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });
}
