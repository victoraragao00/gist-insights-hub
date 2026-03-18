import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export interface DemandAttachment {
  id: string;
  demand_id: string;
  type: "file" | "link";
  url: string;
  filename: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_by: string | null;
  created_at: string | null;
}

export function useDemandAttachments(demandId: string) {
  return useQuery({
    queryKey: ["demand_attachments", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_attachments")
        .select("*")
        .eq("demand_id", demandId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as DemandAttachment[];
    },
  });
}

export function useUploadAttachments() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ demandId, files }: { demandId: string; files: File[] }) => {
      const results: DemandAttachment[] = [];
      for (const file of files) {
        const ts = Date.now();
        const path = `demands/${demandId}/${ts}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("demand-attachments")
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("demand-attachments")
          .getPublicUrl(path);

        const { data, error } = await supabase
          .from("demand_attachments")
          .insert({
            demand_id: demandId,
            type: "file" as const,
            url: urlData.publicUrl,
            filename: file.name,
            size_bytes: file.size,
            mime_type: file.type,
            created_by: user?.id ?? null,
          })
          .select("*")
          .single();
        if (error) throw error;
        results.push(data as DemandAttachment);
      }
      return results;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_attachments", vars.demandId] });
      toast.success("Arquivo(s) enviado(s)");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo"),
  });
}

export function useAddLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ demandId, url }: { demandId: string; url: string }) => {
      const { error } = await supabase.from("demand_attachments").insert({
        demand_id: demandId,
        type: "link" as const,
        url,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["demand_attachments", vars.demandId] });
      toast.success("Link adicionado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao adicionar link"),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachment: DemandAttachment) => {
      if (attachment.type === "file" && attachment.url) {
        // Extract storage path from URL
        const match = attachment.url.match(/demand-attachments\/(.+)$/);
        if (match) {
          const { error: storageError } = await supabase.storage
            .from("demand-attachments")
            .remove([match[1]]);
          if (storageError) console.error("Storage delete error:", storageError.message);
        }
      }
      const { error } = await supabase
        .from("demand_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
      return attachment.demand_id;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({ queryKey: ["demand_attachments", demandId] });
      toast.success("Anexo removido");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao remover anexo"),
  });
}
