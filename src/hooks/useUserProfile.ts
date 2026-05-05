import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type DefaultWorkspace = "cx" | "tech" | "both";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  global_role: string | null;
  active: boolean | null;
  default_workspace: DefaultWorkspace;
}

export function useUserProfile() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, global_role, active, default_workspace")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const dw = (data.default_workspace as DefaultWorkspace | null) ?? "cx";
      return { ...data, default_workspace: dw } as UserProfile;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { profile: data ?? null, isLoading };
}
