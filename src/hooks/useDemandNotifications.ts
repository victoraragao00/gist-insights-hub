import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export interface DemandNotification {
  id: string;
  user_id: string;
  demand_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string | null;
}

export function useDemandNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["demand_notifications", user?.id],
    staleTime: 10_000,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as DemandNotification[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("demand-notifications-rt")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "demand_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["demand_notifications", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("demand_notifications")
        .update({ read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_notifications", user?.id] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("demand_notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand_notifications", user?.id] });
      toast.success("Todas notificações marcadas como lidas");
    },
  });
}

/** Helper to create notifications for relevant users when a demand action occurs */
export async function createDemandNotification(input: {
  demandId: string;
  type: "moved" | "assigned" | "created" | "commented";
  message: string;
  actorId: string;
  assigneeId?: string | null;
  creatorId?: string | null;
}) {
  const targetUserIds = new Set<string>();
  
  // Notify assignee if different from actor
  if (input.assigneeId && input.assigneeId !== input.actorId) {
    targetUserIds.add(input.assigneeId);
  }
  // Notify creator if different from actor
  if (input.creatorId && input.creatorId !== input.actorId) {
    targetUserIds.add(input.creatorId);
  }

  if (targetUserIds.size === 0) return;

  const rows = Array.from(targetUserIds).map((userId) => ({
    user_id: userId,
    demand_id: input.demandId,
    type: input.type,
    message: input.message,
  }));

  const { error } = await supabase.from("demand_notifications").insert(rows);
  if (error) {
    console.error("Notification insert error:", error.message);
    toast.error("Falha ao enviar notificações");
  }
}
