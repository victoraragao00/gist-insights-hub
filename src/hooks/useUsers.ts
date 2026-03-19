import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface UserWithPermissions {
  user_id: string;
  email: string;
  full_name: string | null;
  global_role: "admin" | "analyst" | "viewer";
  active: boolean;
  client_overrides: Array<{
    client_id: string;
    client_name: string;
    role: string;
  }>;
  last_sign_in: string | null;
}

export function useUsers() {
  const { user } = useAuth();

  return useQuery<UserWithPermissions[]>({
    queryKey: ["users_with_permissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_users_with_permissions" as never) as {
        data: UserWithPermissions[] | null;
        error: { message?: string; code?: string } | null;
      };
      // RPC lança exceção se caller não é admin — retornar vazio sem quebrar UI
      if (error) {
        if (
          error.message?.includes("Acesso negado") ||
          error.code === "P0001" ||
          error.code === "42501"
        ) {
          return [];
        }
        throw error;
      }
      return (data ?? []) as UserWithPermissions[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    retry: false,
  });
}
