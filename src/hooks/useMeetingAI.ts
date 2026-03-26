import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useProcessTranscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agendaId,
      transcription,
    }: {
      agendaId: string;
      transcription: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "process-meeting-transcription",
        { body: { agenda_id: agendaId, transcription } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, { agendaId }) => {
      queryClient.invalidateQueries({ queryKey: ["meeting_agenda"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_agendas"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_homework"] });
      toast.success("Transcrição processada com sucesso");
    },
    onError: (error) => {
      toast.error(`Erro ao processar transcrição: ${error.message}`);
    },
  });
}

export function useConvertHomeworkToTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      homeworkItemId,
      agendaId,
      demandId,
    }: {
      homeworkItemId: string;
      agendaId: string;
      demandId: string;
    }) => {
      const { error } = await supabase
        .from("meeting_homework_items")
        .update({ converted_to_demand_id: demandId, status: "converted" })
        .eq("id", homeworkItemId);
      if (error) throw error;
    },
    onSuccess: (_, { agendaId }) => {
      queryClient.invalidateQueries({ queryKey: ["meeting_homework"] });
      toast.success("Lição de casa vinculada ao ticket");
    },
    onError: () => {
      toast.error("Erro ao vincular ao ticket");
    },
  });
}
