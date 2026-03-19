import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface ClientToken {
  id: string;
  client_id: string;
  token: string;
  active: boolean;
  created_at: string | null;
}

export function useClientToken(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery<ClientToken | null>({
    queryKey: ["client_token", clientId],
    enabled: !!clientId && !!user?.id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_client_tokens")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ClientToken | null);
    },
  });
}

export function useGenerateClientToken(clientId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("clientId obrigatório");
      if (!user?.id) throw new Error("Não autenticado");

      // Use upsert with ON CONFLICT to regenerate token
      const { data, error } = await supabase
        .from("demand_client_tokens")
        .upsert(
          { client_id: clientId, created_by: user.id, active: true },
          { onConflict: "client_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as ClientToken;
    },
    onSuccess: () => {
      toast.success("Link gerado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["client_token", clientId] });
    },
    onError: (err) => {
      toast.error("Erro ao gerar link: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
