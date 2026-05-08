import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export interface DemandAttachment {
  id: string;
  demand_id: string;
  type: "file" | "link";
  url: string; // for files = storage path; for links = absolute URL
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

/**
 * Extract storage path from either a raw path ("demands/<id>/file.png")
 * or a legacy public URL ("https://.../demand-attachments/demands/<id>/file.png").
 */
export function extractAttachmentPath(url: string): string {
  const match = url.match(/demand-attachments\/(.+)$/);
  return match ? match[1] : url;
}

/**
 * Generate signed URLs for file attachments. Links are passed through as-is.
 */
export function useSignedAttachmentUrls(attachments: DemandAttachment[]) {
  return useQuery({
    queryKey: [
      "demand_attachments_signed",
      attachments.map((a) => a.id).join(","),
    ],
    staleTime: 30 * 60_000, // signed URLs valid 1h, refresh after 30min
    enabled: attachments.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const filePaths = attachments
        .filter((a) => a.type === "file")
        .map((a) => ({ id: a.id, path: extractAttachmentPath(a.url) }));

      if (filePaths.length > 0) {
        const { data, error } = await supabase.storage
          .from("demand-attachments")
          .createSignedUrls(
            filePaths.map((f) => f.path),
            3600,
          );
        if (error) throw error;
        data?.forEach((entry, idx) => {
          if (entry.signedUrl) map[filePaths[idx].id] = entry.signedUrl;
        });
      }

      attachments
        .filter((a) => a.type === "link")
        .forEach((a) => {
          map[a.id] = a.url;
        });

      return map;
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
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `demands/${demandId}/${ts}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("demand-attachments")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { data, error } = await supabase
          .from("demand_attachments")
          .insert({
            demand_id: demandId,
            type: "file" as const,
            url: path, // store path, not public URL (bucket is private)
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
    onError: (err) =>
      toast.error("Erro no upload: " + (err instanceof Error ? err.message : String(err))),
  });
}

export function useAddLink() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ demandId, url, label }: { demandId: string; url: string; label?: string }) => {
      const { error } = await supabase.from("demand_attachments").insert({
        demand_id: demandId,
        type: "link" as const,
        url,
        filename: label ?? null,
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

/**
 * Upload a single image inline (used by the rich-text editor for paste/drag/insert).
 * Does NOT create a row in `demand_attachments` — inline images live only inside the HTML.
 * Returns the storage path and a short-lived signed URL for immediate preview.
 */
export async function uploadInlineImage(
  demandId: string,
  file: File,
): Promise<{ storagePath: string; signedUrl: string }> {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^\w]/g, "");
  const path = `demands/${demandId}/inline/${ts}_${rand}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("demand-attachments")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.storage
    .from("demand-attachments")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return { storagePath: path, signedUrl: data.signedUrl };
}

/**
 * Resolve a list of storage paths to signed URLs (1h, refreshed every 30min).
 */
export function useResolveStoragePaths(paths: string[]) {
  const sorted = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ["demand_inline_signed", sorted.join("|")],
    staleTime: 30 * 60_000,
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("demand-attachments")
        .createSignedUrls(sorted, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((entry, idx) => {
        if (entry.signedUrl) map[sorted[idx]] = entry.signedUrl;
      });
      return map;
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachment: DemandAttachment) => {
      if (attachment.type === "file" && attachment.url) {
        const path = extractAttachmentPath(attachment.url);
        const { error: storageError } = await supabase.storage
          .from("demand-attachments")
          .remove([path]);
        if (storageError) console.error("Storage delete error:", storageError.message);
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
