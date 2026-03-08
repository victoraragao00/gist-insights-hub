import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type UserRole = "admin" | "viewer";

export function useUserRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<{ role: UserRole; isAdmin: boolean }> => {
      if (!user?.id) return { role: "viewer", isAdmin: false };
      const { data: rows, error } = await supabase
        .from("user_client_access")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      const isAdmin = (rows ?? []).some((r) => r.role != null && r.role === "admin");
      return { role: isAdmin ? "admin" : "viewer", isAdmin };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    role: data?.role ?? "viewer",
    isAdmin: data?.isAdmin ?? false,
    isLoading,
  };
}
