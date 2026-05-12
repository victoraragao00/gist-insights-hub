import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type BlockerType = Tables<"blocker_types">;

export function useBlockerTypes() {
  return useQuery<BlockerType[]>({
    queryKey: ["blocker_types", "active"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocker_types")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllBlockerTypes() {
  return useQuery<BlockerType[]>({
    queryKey: ["blocker_types", "all"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocker_types")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateBlockerType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      color: string;
      icon: string;
      position: number;
      requires_reason?: boolean;
    }) => {
      const { error } = await supabase.from("blocker_types").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocker_types"] });
      toast.success("Tipo de bloqueio criado");
    },
    onError: (err) =>
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro")),
  });
}

export function useUpdateBlockerType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      fields: Partial<
        Pick<BlockerType, "name" | "color" | "icon" | "position" | "active" | "requires_reason">
      >;
    }) => {
      const { error } = await supabase
        .from("blocker_types")
        .update(input.fields)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocker_types"] });
    },
    onError: (err) =>
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro")),
  });
}

export function useToggleBlockerTypeActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("blocker_types")
        .update({ active: input.active })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["blocker_types"] });
      toast.success(vars.active ? "Tipo reativado" : "Tipo desativado");
    },
    onError: (err) =>
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro")),
  });
}
