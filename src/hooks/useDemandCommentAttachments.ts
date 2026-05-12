import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export interface DemandCommentAttachment {
  id: string;
  comment_id: string;
  demand_id: string;
  type: "file" | "link";
  url: string;
  filename: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_by: string | null;
  created_at: string | null;
}

const BUCKET = "demand-attachments";

export function extractCommentAttachmentPath(url: string): string {
  const m = url.match(/demand-attachments\/(.+)$/);
  return m ? m[1] : url;
}

/** Fetch attachments for all comments of a demand. */
export function useDemandCommentAttachments(demandId: string | undefined) {
  return useQuery({
    queryKey: ["demand_comment_attachments", demandId],
    enabled: !!demandId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_comment_attachments")
        .select("*")
        .eq("demand_id", demandId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DemandCommentAttachment[];
    },
  });
}

export function useSignedCommentAttachmentUrls(attachments: DemandCommentAttachment[]) {
  return useQuery({
    queryKey: [
      "demand_comment_attachments_signed",
      attachments.map((a) => a.id).join(","),
    ],
    enabled: attachments.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const files = attachments
        .filter((a) => a.type === "file")
        .map((a) => ({ id: a.id, path: extractCommentAttachmentPath(a.url) }));

      if (files.length > 0) {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(files.map((f) => f.path), 3600);
        if (error) throw error;
        data?.forEach((entry, idx) => {
          if (entry.signedUrl) map[files[idx].id] = entry.signedUrl;
        });
      }
      attachments.filter((a) => a.type === "link").forEach((a) => {
        map[a.id] = a.url;
      });
      return map;
    },
  });
}

export function useUploadCommentAttachments() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      commentId,
      demandId,
      files,
    }: {
      commentId: string;
      demandId: string;
      files: File[];
    }) => {
      const inserted: DemandCommentAttachment[] = [];
      for (const file of files) {
        const ts = Date.now();
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `demands/${demandId}/comments/${commentId}/${ts}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;

        const { data, error } = await supabase
          .from("demand_comment_attachments")
          .insert({
            comment_id: commentId,
            demand_id: demandId,
            type: "file" as const,
            url: path,
            filename: file.name,
            size_bytes: file.size,
            mime_type: file.type,
            created_by: user?.id ?? null,
          })
          .select("*")
          .single();
        if (error) throw error;
        inserted.push(data as DemandCommentAttachment);
      }
      return inserted;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["demand_comment_attachments", vars.demandId],
      });
    },
    onError: (err) =>
      toast.error("Erro no upload: " + (err instanceof Error ? err.message : String(err))),
  });
}

export function useDeleteCommentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (att: DemandCommentAttachment) => {
      if (att.type === "file" && att.url) {
        const path = extractCommentAttachmentPath(att.url);
        const { error: stErr } = await supabase.storage.from(BUCKET).remove([path]);
        if (stErr) console.error("storage delete:", stErr.message);
      }
      const { error } = await supabase
        .from("demand_comment_attachments")
        .delete()
        .eq("id", att.id);
      if (error) throw error;
      return att.demand_id;
    },
    onSuccess: (demandId) => {
      queryClient.invalidateQueries({
        queryKey: ["demand_comment_attachments", demandId],
      });
      toast.success("Anexo removido");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao remover anexo"),
  });
}
