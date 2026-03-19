import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useUpdateUserRole, useToggleUserActive } from "@/hooks/useUserManagement";
import { useDebounce } from "@/hooks/useDebounce";
import { UserPermissionsSheet } from "./UserPermissionsSheet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Settings2, UserPlus, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UserRole } from "@/hooks/useUserRole";
import type { UserWithPermissions } from "@/hooks/useUsers";

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <Badge className="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-50">
        admin
      </Badge>
    );
  }
  if (role === "analyst") {
    return (
      <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">
        analyst
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">
      viewer
    </Badge>
  );
}

function UserAvatar({ name, email }: { name: string | null; email: string }) {
  const initial = (name ?? email).charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
      {initial}
    </div>
  );
}

export function UserManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useUsers();
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [permissionsUser, setPermissionsUser] = useState<UserWithPermissions | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserWithPermissions | null>(null);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer");

  const inviteMutation = useMutation({
    mutationFn: async ({ email, full_name, role }: { email: string; full_name: string; role: UserRole }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão inválida");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, full_name: full_name || null, role }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao convidar usuário");
      return json;
    },
    onSuccess: () => {
      toast.success("Convite enviado com sucesso! O usuário receberá um e-mail de acesso.");
      queryClient.invalidateQueries({ queryKey: ["users_with_permissions"] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("viewer");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao convidar");
    },
  });

  const filtered = useMemo(() => {
    if (!debouncedSearch) return users;
    const q = debouncedSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
    );
  }, [users, debouncedSearch]);

  const activeCount = users.filter((u) => u.active).length;

  const isSelf = (targetId: string) => targetId === user?.id;

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base font-semibold">Gerenciamento de Usuários</CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? "Carregando..." : `${activeCount} usuário${activeCount !== 1 ? "s" : ""} ativo${activeCount !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar por nome ou e-mail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Convidar usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Usuário</TableHead>
                <TableHead>Role Global</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-8 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.user_id} className={!u.active ? "opacity-50" : undefined}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={u.full_name} email={u.email} />
                        <div>
                          <p className="text-sm font-medium leading-none">{u.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSelf(u.user_id) ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <RoleBadge role={u.global_role} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Você não pode alterar seu próprio papel</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Select
                          value={u.global_role}
                          onValueChange={(val) =>
                            updateRole.mutate({
                              targetUserId: u.user_id,
                              newRole: val as UserRole,
                              allUsers: users,
                            })
                          }
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-32 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="analyst">analyst</SelectItem>
                            <SelectItem value="viewer">viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {u.global_role === "admin"
                            ? "Todos"
                            : `${u.client_overrides.length} override${u.client_overrides.length !== 1 ? "s" : ""}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setPermissionsUser(u)}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in
                        ? formatDistanceToNow(new Date(u.last_sign_in), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {isSelf(u.user_id) ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch checked={u.active} disabled />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Você não pode alterar seu próprio acesso</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Switch
                          checked={u.active}
                          onCheckedChange={() => {
                            if (u.active) {
                              setConfirmDeactivate(u);
                            } else {
                              toggleActive.mutate({ targetUserId: u.user_id, currentActive: u.active });
                            }
                          }}
                          disabled={toggleActive.isPending}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permissions Sheet */}
      {permissionsUser && (
        <UserPermissionsSheet
          user={permissionsUser}
          open={!!permissionsUser}
          onClose={() => setPermissionsUser(null)}
        />
      )}

      {/* Deactivation confirm dialog */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeactivate?.email} perderá acesso ao sistema. Você poderá reativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeactivate) {
                  toggleActive.mutate({
                    targetUserId: confirmDeactivate.user_id,
                    currentActive: confirmDeactivate.active,
                  });
                  setConfirmDeactivate(null);
                }
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
