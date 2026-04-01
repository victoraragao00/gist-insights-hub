import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface ClientDocument {
  id: string;
  client_id: string;
  title: string;
  category: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { full_name: string | null; email: string | null } | null;
}

export function useClientDocuments(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery<ClientDocument[]>({
    queryKey: ["client_documents", clientId],
    enabled: !!clientId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*, user_profiles!client_documents_assignee_id_fkey(full_name, email)")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => {
        const { user_profiles, ...rest } = row;
        return { ...rest, assignee: user_profiles ?? null } as ClientDocument;
      });
    },
  });
}

export function useCreateDocument(clientId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      category: string;
      description?: string;
      url?: string;
      file_path?: string;
      file_name?: string;
      file_size_bytes?: number;
      mime_type?: string;
      assignee_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("client_documents")
        .insert({
          client_id: clientId!,
          created_by: user!.id,
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      toast.success("Documento adicionado");
    },
    onError: (err: Error) => toast.error(`Erro ao criar documento: ${err.message}`),
  });
}

export function useUpdateDocument(clientId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<{
      title: string;
      category: string;
      description: string | null;
      url: string | null;
      assignee_id: string | null;
    }>) => {
      const { error } = await supabase
        .from("client_documents")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_documents", clientId] }),
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });
}

export function useDeleteDocument(clientId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath?: string | null }) => {
      if (filePath) {
        const { error: storageErr } = await supabase.storage
          .from("client-documents")
          .remove([filePath]);
        if (storageErr) console.warn("Storage delete failed:", storageErr.message);
      }
      const { error } = await supabase
        .from("client_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      toast.success("Documento removido");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });
}

export function useUploadDocument(clientId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const timestamp = Date.now();
      const path = `${clientId}/${timestamp}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("client-documents")
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase
        .from("client_documents")
        .insert({
          client_id: clientId!,
          created_by: user!.id,
          title: file.name.replace(/\.[^/.]+$/, ""),
          category: "outro",
          file_path: path,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      toast.success("Arquivo enviado com sucesso");
    },
    onError: (err: Error) => toast.error(`Erro no upload: ${err.message}`),
  });
}
