import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface DemandComment {
  id: string;
  demand_id: string;
  content: string;
  edited: boolean;
  edited_at: string | null;
  created_by: string | null;
  created_at: string | null;
}

// ── useDemandComments ──

export function useDemandComments(demandId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<DemandComment[]>({
    queryKey: ["demand_comments", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_comments")
        .select("id, demand_id, content, edited, edited_at, created_by, created_at")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DemandComment[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!demandId) return;

    const channel = supabase
      .channel(`demand_comments_${demandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "demand_comments",
          filter: `demand_id=eq.${demandId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["demand_comments", demandId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [demandId, queryClient]);

  return query;
}

// ── useCreateComment ──

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      demandId,
      content,
    }: {
      demandId: string;
      content: string;
    }) => {
      const { error: commentErr } = await supabase.from("demand_comments").insert({
        demand_id: demandId,
        content,
        created_by: user?.id ?? null,
      });
      if (commentErr) throw commentErr;

      // Log activity
      const { error: actErr } = await supabase.from("demand_activities").insert({
        demand_id: demandId,
        event_type: "commented",
        description: "Comentário adicionado",
        created_by: user?.id ?? null,
      });
      if (actErr) throw actErr;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_comments", vars.demandId] });
      queryClient.invalidateQueries({ queryKey: ["demand_activities", vars.demandId] });
    },
    onError: (err) => {
      toast.error("Erro ao comentar: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}

// ── useUpdateComment ──

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      demandId,
      content,
    }: {
      id: string;
      demandId: string;
      content: string;
    }) => {
      const { error } = await supabase
        .from("demand_comments")
        .update({ content, edited: true, edited_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_comments", vars.demandId] });
    },
    onError: (err) => {
      toast.error("Erro ao editar comentário: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}

// ── useDeleteComment ──

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, demandId }: { id: string; demandId: string }) => {
      const { error } = await supabase.from("demand_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_comments", vars.demandId] });
    },
    onError: (err) => {
      toast.error("Erro ao excluir comentário: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
