import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface MeetingParticipant {
  id: string;
  agenda_id: string;
  participant_id: string | null;
  user_profile_id: string | null;
  present: boolean | null;
  created_at: string | null;
  // Joined fields
  participant_name?: string;
  user_name?: string;
}

export function useMeetingParticipants(agendaId: string | null) {
  const { user } = useAuth();

  return useQuery<MeetingParticipant[]>({
    queryKey: ["meeting_participants", user?.id, agendaId],
    enabled: !!user?.id && !!agendaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select("*, participants(name), user_profiles(full_name)")
        .eq("agenda_id", agendaId!)
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        agenda_id: row.agenda_id as string,
        participant_id: row.participant_id as string | null,
        user_profile_id: row.user_profile_id as string | null,
        present: row.present as boolean | null,
        created_at: row.created_at as string | null,
        participant_name: (row.participants as { name: string } | null)?.name,
        user_name: (row.user_profiles as { full_name: string } | null)?.full_name,
      }));
    },
  });
}

export function useAddMeetingParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      agenda_id: string;
      participant_id?: string;
      user_profile_id?: string;
    }) => {
      const { error } = await supabase
        .from("meeting_participants")
        .insert(payload as Record<string, unknown>);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["meeting_participants"] });
    },
    onError: (err) => toast.error(`Erro ao adicionar participante: ${err.message}`),
  });
}

export function useRemoveMeetingParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_participants")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_participants"] });
    },
    onError: (err) => toast.error(`Erro ao remover participante: ${err.message}`),
  });
}
