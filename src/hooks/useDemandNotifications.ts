import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export type DemandNotificationType =
  | "moved"
  | "assigned"
  | "created"
  | "commented"
  | "status_changed"
  | "blocked"
  | "unblocked"
  | "mentioned";

export interface DemandNotification {
  id: string;
  user_id: string;
  demand_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string | null;
  demands?: { id: string; title: string } | null;
}

export function useDemandNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["demand_notifications", user?.id],
    staleTime: 0,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_notifications")
        .select("*, demands:demand_id(id, title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DemandNotification[];
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

/** Resolve unique recipient user IDs (owner + collaborators + watchers, minus actor). */
async function getNotificationRecipients(
  demandId: string,
  excludeUserId: string | null
): Promise<string[]> {
  const [demandRes, collabRes, watcherRes] = await Promise.all([
    supabase.from("demands").select("assignee_id").eq("id", demandId).maybeSingle(),
    supabase.from("demand_collaborators").select("user_id").eq("demand_id", demandId),
    supabase.from("demand_watchers").select("user_id").eq("demand_id", demandId),
  ]);

  const all = new Set<string>();
  if (demandRes.data?.assignee_id) all.add(demandRes.data.assignee_id);
  for (const c of collabRes.data ?? []) if (c.user_id) all.add(c.user_id);
  for (const w of watcherRes.data ?? []) if (w.user_id) all.add(w.user_id);
  if (excludeUserId) all.delete(excludeUserId);
  return [...all];
}

/** Notify owner + collaborators + watchers of a demand event. */
export async function createDemandNotification(input: {
  demandId: string;
  type: DemandNotificationType;
  message: string;
  actorId: string | null;
}) {
  const recipients = await getNotificationRecipients(input.demandId, input.actorId);
  if (recipients.length === 0) return;

  const rows = recipients.map((userId) => ({
    user_id: userId,
    demand_id: input.demandId,
    type: input.type,
    message: input.message,
  }));

  const { error } = await supabase.from("demand_notifications").insert(rows);
  if (error) console.error("Notification insert error:", error.message);
}

/** Notify a specific list of mentioned users. */
export async function createMentionNotifications(input: {
  demandId: string;
  userIds: string[];
  actorId: string | null;
  message?: string;
}) {
  const targets = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  if (targets.length === 0) return;

  const rows = targets.map((userId) => ({
    user_id: userId,
    demand_id: input.demandId,
    type: "mentioned" as const,
    message: input.message ?? "Você foi mencionado em um comentário",
  }));

  const { error } = await supabase.from("demand_notifications").insert(rows);
  if (error) console.error("Mention notification error:", error.message);
}
