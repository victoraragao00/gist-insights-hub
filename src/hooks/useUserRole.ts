import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type UserRole = "admin" | "analyst" | "viewer";

export function useUserRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<{ role: UserRole; isAdmin: boolean; isAnalyst: boolean }> => {
      if (!user?.id) return { role: "viewer", isAdmin: false, isAnalyst: false };

      // Primary: read from user_profiles
      const { data: profile, error: profileErr } = await supabase
        .from("user_profiles")
        .select("global_role, active")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileErr && profile) {
        const role = (profile.global_role as UserRole) ?? "viewer";
        return { role, isAdmin: role === "admin", isAnalyst: role === "analyst" };
      }

      // Fallback: legacy logic via user_client_access
      const { data: rows, error } = await supabase
        .from("user_client_access")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      const isAdmin = (rows ?? []).some((r) => r.role === "admin");
      return { role: isAdmin ? "admin" : "viewer", isAdmin, isAnalyst: false };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    role: data?.role ?? "viewer",
    isAdmin: data?.isAdmin ?? false,
    isAnalyst: data?.isAnalyst ?? false,
    isLoading,
  };
}
