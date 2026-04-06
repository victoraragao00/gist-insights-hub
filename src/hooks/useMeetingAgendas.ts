import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface MeetingAgenda {
  id: string;
  client_id: string;
  title: string;
  meeting_date: string;
  location: string | null;
  objective: string | null;
  context_notes: string | null;
  executive_summary: string | null;
  transcription: string | null;
  satisfaction_score: number | null;
  next_steps: string | null;
  duration_minutes: number | null;
  ai_processed: boolean | null;
  ai_processed_at: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface MeetingAgendaWithClient extends MeetingAgenda {
  clients?: { name: string } | null;
}

export interface MeetingAgendasFilters {
  clientId?: string;
  periodDays?: number;
  satisfactionScore?: number;
}

export function useMeetingAgendas(filters?: MeetingAgendasFilters) {
  const { user } = useAuth();
  const clientId = filters?.clientId;
  const periodDays = filters?.periodDays;
  const satisfactionScore = filters?.satisfactionScore;

  return useQuery<MeetingAgendaWithClient[]>({
    queryKey: ["meeting_agendas", user?.id, clientId ?? "all", periodDays ?? "all", satisfactionScore ?? "all"],
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("meeting_agendas")
        .select("*, clients(name)")
        .order("meeting_date", { ascending: false })
        .limit(100);

      if (clientId) {
        query = query.eq("client_id", clientId);
      }
      if (periodDays) {
        const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("meeting_date", since);
      }
      if (satisfactionScore !== undefined) {
        query = query.eq("satisfaction_score", satisfactionScore);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as MeetingAgendaWithClient[];
    },
  });
}

export function useMeetingAgenda(agendaId: string | null) {
  const { user } = useAuth();

  return useQuery<MeetingAgendaWithClient | null>({
    queryKey: ["meeting_agenda", user?.id, agendaId],
    enabled: !!user?.id && !!agendaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_agendas")
        .select("*, clients(name)")
        .eq("id", agendaId!)
        .maybeSingle();
      if (error) throw error;
      return data as MeetingAgendaWithClient | null;
    },
  });
}

interface CreateAgendaPayload {
  client_id: string;
  title: string;
  meeting_date: string;
  location?: string;
  objective?: string;
  context_notes?: string;
  satisfaction_score?: number;
  next_steps?: string;
}

export function useCreateAgenda() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAgendaPayload) => {
      const insertPayload = {
        ...payload,
        created_by: user!.id,
      };
      const { data, error } = await supabase
        .from("meeting_agendas")
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_agendas"] });
      toast.success("Pauta criada com sucesso");
    },
    onError: (err) => toast.error(`Erro ao criar pauta: ${err.message}`),
  });
}

export function useUpdateAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; executive_summary?: string; transcription?: string; duration_minutes?: number | null; objective?: string; context_notes?: string; next_steps?: string; satisfaction_score?: number } & Partial<CreateAgendaPayload>) => {
      const { error } = await supabase
        .from("meeting_agendas")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["meeting_agendas"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_agenda"] });
    },
    onError: (err) => toast.error(`Erro ao atualizar pauta: ${err.message}`),
  });
}

export function useDeleteAgenda() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_agendas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_agendas"] });
      toast.success("Pauta excluída");
    },
    onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
  });
}
