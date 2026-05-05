import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SquadMemberRow {
  user_id: string;
  role: string;
  user_profiles: { id: string; full_name: string | null; email: string | null } | null;
}

export interface SquadRow {
  id: string;
  name: string;
  color: string;
  active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  squad_members: SquadMemberRow[];
}

export function useSquads() {
  return useQuery({
    queryKey: ["squads", "active"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squads")
        .select("*, squad_members(user_id, role, user_profiles(id, full_name, email))")
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as SquadRow[];
    },
  });
}

export function useAllSquads() {
  return useQuery({
    queryKey: ["squads", "all"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squads")
        .select("*, squad_members(user_id, role, user_profiles(id, full_name, email))")
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as SquadRow[];
    },
  });
}

export function useUpdateDemandSquad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ demandId, squadId }: { demandId: string; squadId: string | null }) => {
      const { error } = await supabase
        .from("demands")
        .update({ squad_id: squadId })
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
    onError: (err) =>
      toast.error("Erro ao mover demanda: " + (err instanceof Error ? err.message : "Erro")),
  });
}

export function useCreateSquad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; position: number }) => {
      const { error } = await supabase.from("squads").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["squads"] });
      toast.success("Squad criado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar squad"),
  });
}

export function useUpdateSquad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fields,
    }: {
      id: string;
      fields: Partial<{ name: string; color: string; position: number; active: boolean }>;
    }) => {
      const { error } = await supabase.from("squads").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["squads"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar squad"),
  });
}

export function useDeleteSquad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("squads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["squads"] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Squad excluído");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir squad"),
  });
}

export function useAddSquadMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      squadId,
      userId,
      role = "member",
    }: {
      squadId: string;
      userId: string;
      role?: "lead" | "member";
    }) => {
      const { error } = await supabase
        .from("squad_members")
        .insert({ squad_id: squadId, user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["squads"] });
      toast.success("Membro adicionado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao adicionar membro"),
  });
}

export function useRemoveSquadMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ squadId, userId }: { squadId: string; userId: string }) => {
      const { error } = await supabase
        .from("squad_members")
        .delete()
        .eq("squad_id", squadId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["squads"] });
      toast.success("Membro removido");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao remover membro"),
  });
}
