import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface HomeworkItem {
  id: string;
  agenda_id: string;
  description: string;
  responsible_side: string;
  responsible_label: string | null;
  due_date: string | null;
  status: string;
  converted_to_demand_id: string | null;
  created_at: string | null;
}

export function useMeetingHomework(agendaId: string | null) {
  const { user } = useAuth();

  return useQuery<HomeworkItem[]>({
    queryKey: ["meeting_homework", user?.id, agendaId],
    enabled: !!user?.id && !!agendaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_homework_items")
        .select("*")
        .eq("agenda_id", agendaId!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as HomeworkItem[];
    },
  });
}

export function useCreateHomeworkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      agenda_id: string;
      description: string;
      responsible_side: string;
      responsible_label?: string;
      due_date?: string;
    }) => {
      const { error } = await supabase
        .from("meeting_homework_items")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_homework"] });
      toast.success("Item adicionado");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateHomeworkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; converted_to_demand_id?: string; status?: string; description?: string }) => {
      const { error } = await supabase
        .from("meeting_homework_items")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_homework"] });
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
}

export function useDeleteHomeworkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_homework_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_homework"] });
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
}
