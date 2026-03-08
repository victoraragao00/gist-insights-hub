import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface RecalculateInput {
  client_id?: string;
}

export function useRecalculatePriority() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (input?: RecalculateInput) => {
      const token = session?.access_token;
      if (!token) throw new Error("Não autenticado");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-priority-scores`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input ?? {}),
      });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Forbidden");
      }
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ processed?: number; hasMore?: boolean; calculatedAt?: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["priority-scores"] });
      toast.success("Scores atualizados");
    },
    onError: () => {
      toast.error("Erro ao atualizar scores");
    },
  });
}
