import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { UserRole } from "@/hooks/useUserRole";
import type { UserWithPermissions } from "@/hooks/useUsers";

// ── useUpdateUserRole ─────────────────────────────────────────────────────────

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      targetUserId,
      newRole,
      allUsers,
    }: {
      targetUserId: string;
      newRole: UserRole;
      allUsers: UserWithPermissions[];
    }) => {
      // Protection: cannot change own role
      if (targetUserId === user?.id) {
        throw new Error("Você não pode alterar o seu próprio papel");
      }

      // Protection: cannot demote last admin
      if (newRole !== "admin") {
        const adminCount = allUsers.filter((u) => u.global_role === "admin").length;
        const targetIsAdmin = allUsers.find((u) => u.user_id === targetUserId)?.global_role === "admin";
        if (adminCount === 1 && targetIsAdmin) {
          throw new Error("Não é possível remover o último admin");
        }
      }

      const { error } = await supabase
        .from("user_profiles" as never)
        .update({ global_role: newRole, updated_at: new Date().toISOString() } as never)
        .eq("id", targetUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-role"] });
      toast.success("Papel atualizado com sucesso");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar papel");
    },
  });
}

// ── useUpdateClientAccess ─────────────────────────────────────────────────────

export function useUpdateClientAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      clientId,
      role,
    }: {
      userId: string;
      clientId: string;
      role: string;
    }) => {
      const { error } = await supabase
        .from("user_client_access")
        .upsert({ user_id: userId, client_id: clientId, role }, { onConflict: "user_id,client_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_permissions"] });
      toast.success("Acesso por cliente atualizado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar acesso");
    },
  });
}

// ── useRemoveClientAccess ─────────────────────────────────────────────────────

export function useRemoveClientAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, clientId }: { userId: string; clientId: string }) => {
      const { error } = await supabase
        .from("user_client_access")
        .delete()
        .eq("user_id", userId)
        .eq("client_id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_permissions"] });
      toast.success("Acesso removido");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao remover acesso");
    },
  });
}

// ── useToggleUserActive ───────────────────────────────────────────────────────

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      targetUserId,
      currentActive,
    }: {
      targetUserId: string;
      currentActive: boolean;
    }) => {
      if (targetUserId === user?.id) {
        throw new Error("Você não pode desativar sua própria conta");
      }

      const { error } = await supabase
        .from("user_profiles" as never)
        .update({ active: !currentActive, updated_at: new Date().toISOString() } as never)
        .eq("id", targetUserId);
      if (error) throw error;
    },
    onSuccess: (_, { currentActive }) => {
      queryClient.invalidateQueries({ queryKey: ["users_with_permissions"] });
      toast.success(currentActive ? "Usuário desativado" : "Usuário ativado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar status");
    },
  });
}
