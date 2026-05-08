import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  category: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectDocuments(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery<ProjectDocument[]>({
    queryKey: ["project_documents", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ProjectDocument[];
    },
  });
}

export function useCreateProjectDocument(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category: string;
      description?: string | null;
      url?: string | null;
      file_path?: string | null;
      file_name?: string | null;
      file_size_bytes?: number | null;
      mime_type?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("project_documents")
        .insert({ project_id: projectId!, created_by: user!.id, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_documents", projectId] });
      toast.success("Documento adicionado");
    },
    onError: (err: Error) => toast.error(`Erro ao criar documento: ${err.message}`),
  });
}

export function useUpdateProjectDocument(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<{
      title: string;
      category: string;
      description: string | null;
      url: string | null;
    }>) => {
      const { error } = await supabase
        .from("project_documents")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_documents", projectId] }),
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });
}

export function useDeleteProjectDocument(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath?: string | null }) => {
      if (filePath) {
        const { error: storageErr } = await supabase.storage
          .from("project-documents")
          .remove([filePath]);
        if (storageErr) console.warn("Storage delete failed:", storageErr.message);
      }
      const { error } = await supabase.from("project_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_documents", projectId] });
      toast.success("Documento removido");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir: ${err.message}`),
  });
}

export function useUploadProjectDocument(projectId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const path = `${projectId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("project-documents")
        .upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data, error } = await supabase
        .from("project_documents")
        .insert({
          project_id: projectId!,
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
      qc.invalidateQueries({ queryKey: ["project_documents", projectId] });
      toast.success("Arquivo enviado");
    },
    onError: (err: Error) => toast.error(`Erro no upload: ${err.message}`),
  });
}

export function useSignedProjectDocUrls(docs: ProjectDocument[]) {
  const paths = docs.filter((d) => d.file_path).map((d) => d.file_path!);
  const sorted = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ["project_documents_signed", sorted.join("|")],
    enabled: sorted.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("project-documents")
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
