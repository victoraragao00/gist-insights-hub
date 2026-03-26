import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface LinkedInteraction {
  id: string; // demand_interactions.id
  interaction_id: string;
  created_by: string | null;
  created_at: string | null;
  interactions: {
    id: string;
    content: string | null;
    sender_raw: string | null;
    sender_side: string | null;
    occurred_at: string;
    conversation_id: string | null;
  };
}

export interface ClientConversation {
  conversation_id: string;
  message_count: number;
  first_message_at: string;
  last_message_at: string;
  last_content: string | null;
  sender_side: string | null;
}

export interface ConversationMessage {
  id: string;
  content: string | null;
  sender_raw: string | null;
  sender_side: string | null;
  occurred_at: string;
  conversation_id: string | null;
}

// ── useDemandInteractions ──

export function useDemandInteractions(demandId: string | undefined) {
  return useQuery<LinkedInteraction[]>({
    queryKey: ["demand_interactions", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_interactions")
        .select(
          `id, interaction_id, created_by, created_at,
           interactions(id, content, sender_raw, sender_side, occurred_at, conversation_id)`
        )
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LinkedInteraction[];
    },
  });
}

// ── useClientConversations ──

export function useClientConversations(clientId: string | undefined) {
  return useQuery<ClientConversation[]>({
    queryKey: ["client_conversations", clientId],
    staleTime: 60_000,
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_conversations", {
        p_client_id: clientId!,
      });
      if (error) throw error;
      return (data ?? []) as ClientConversation[];
    },
  });
}

// ── useConversationMessages ──

export function useConversationMessages(
  conversationId: string | undefined,
  clientId: string | undefined
) {
  return useQuery<ConversationMessage[]>({
    queryKey: ["conversation_messages", conversationId, clientId],
    staleTime: 60_000,
    enabled: !!conversationId && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("id, content, sender_raw, sender_side, occurred_at, conversation_id")
        .eq("conversation_id", conversationId!)
        .eq("client_id", clientId!)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConversationMessage[];
    },
  });
}

// ── useLinkInteractions ──

export function useLinkInteractions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      demandId,
      interactionIds,
      conversationId,
    }: {
      demandId: string;
      interactionIds: string[];
      conversationId: string;
    }) => {
      // Guard: prevent empty calls
      if (!interactionIds.length) return;

      const rows = interactionIds.map((iid) => ({
        demand_id: demandId,
        interaction_id: iid,
        created_by: user?.id ?? null,
      }));

      const { error: linkErr } = await supabase
        .from("demand_interactions")
        .insert(rows)
        .throwOnError();
      if (linkErr) throw linkErr;

      // Log activity
      const { error: actErr } = await supabase.from("demand_activities").insert({
        demand_id: demandId,
        event_type: "linked_interaction",
        description: `${interactionIds.length} mensagem${interactionIds.length > 1 ? "s" : ""} vinculada${interactionIds.length > 1 ? "s" : ""} da conversa ${conversationId}`,
        created_by: user?.id ?? null,
      });
      if (actErr) throw actErr;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_interactions", vars.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand_activities", vars.demandId] });
      toast.success("Mensagens vinculadas ao ticket");
    },
    onError: (err) => {
      toast.error("Erro ao vincular mensagens: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}

// ── useUnlinkInteraction ──

export function useUnlinkInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      demandId,
    }: {
      id: string;
      demandId: string;
    }) => {
      const { error } = await supabase
        .from("demand_interactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_interactions", vars.demandId] });
      toast.success("Mensagem desvinculada");
    },
    onError: (err) => {
      toast.error("Erro ao desvincular: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
