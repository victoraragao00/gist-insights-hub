import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface ClientRule {
  id: string;
  client_id: string;
  description: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientRules(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery<ClientRule[]>({
    queryKey: ["client_rules", clientId],
    enabled: !!clientId && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_rules")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ClientRule[];
    },
  });
}

export function useCreateClientRule(clientId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (description: string) => {
      const { data, error } = await supabase
        .from("client_rules")
        .insert({
          client_id: clientId!,
          created_by: user!.id,
          description,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_rules", clientId] });
      toast.success("Regra criada");
    },
    onError: (err: Error) => toast.error(`Erro ao criar regra: ${err.message}`),
  });
}

export function useUpdateClientRule(clientId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<{
      description: string;
      active: boolean;
    }>) => {
      const { error } = await supabase
        .from("client_rules")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_rules", clientId] }),
    onError: (err: Error) => toast.error(`Erro ao atualizar regra: ${err.message}`),
  });
}

export function useDeleteClientRule(clientId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_rules", clientId] });
      toast.success("Regra removida");
    },
    onError: (err: Error) => toast.error(`Erro ao excluir regra: ${err.message}`),
  });
}
