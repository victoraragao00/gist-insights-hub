import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useUpdateClientAccess, useRemoveClientAccess, useUsersBypass, useUpdateUserBypass } from "@/hooks/useUserManagement";
import { useDebounce } from "@/hooks/useDebounce";
import type { UserWithPermissions } from "@/hooks/useUsers";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, ShieldCheck, Info } from "lucide-react";

interface Client {
  id: string;
  name: string;
  status: string;
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return <Badge className="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-50">admin</Badge>;
  }
  if (role === "analyst") {
    return <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">analyst</Badge>;
  }
  return <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">viewer</Badge>;
}

interface Props {
  user: UserWithPermissions;
  open: boolean;
  onClose: () => void;
}

export function UserPermissionsSheet({ user, open, onClose }: Props) {
  const { user: currentUser } = useAuth();
  const updateAccess = useUpdateClientAccess();
  const removeAccess = useRemoveClientAccess();
  const { data: bypassMap = {} } = useUsersBypass();
  const updateBypass = useUpdateUserBypass();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients_active_for_permissions", currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, status")
        .eq("active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Client[];
    },
    enabled: open && !!currentUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  const overrideMap = useMemo(() => {
    const m = new Map<string, string>();
    user.client_overrides.forEach((o) => m.set(o.client_id, o.role));
    return m;
  }, [user.client_overrides]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return clients;
    const q = debouncedSearch.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, debouncedSearch]);

  const handleChange = (clientId: string, value: string) => {
    if (value === "inherit") {
      removeAccess.mutate({ userId: user.user_id, clientId });
    } else if (value === "none") {
      // "Sem acesso" — store as explicit empty marker; remove record
      removeAccess.mutate({ userId: user.user_id, clientId });
    } else {
      updateAccess.mutate({ userId: user.user_id, clientId, role: value });
    }
  };

  const getClientValue = (clientId: string): string => {
    return overrideMap.get(clientId) ?? "inherit";
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
              {(user.full_name ?? user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <SheetTitle className="text-base">{user.full_name ?? user.email}</SheetTitle>
              <SheetDescription className="text-xs">{user.email}</SheetDescription>
              <div className="mt-1">
                <RoleBadge role={user.global_role} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Bypass TECH toggle */}
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-medium">Acesso TECH completo</p>
              <p className="text-[11px] text-muted-foreground">
                Ver todas as demands do workspace TECH, ignorando restrições por cliente.
              </p>
            </div>
            <Switch
              checked={!!bypassMap[user.user_id]}
              onCheckedChange={(checked) =>
                updateBypass.mutate({ userId: user.user_id, bypass: checked })
              }
              disabled={updateBypass.isPending}
            />
          </div>

          {/* Info callout */}
          {user.global_role === "admin" ? (
            <Alert className="border-purple-200 bg-purple-50">
              <ShieldCheck className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-700 text-xs">
                Este usuário tem acesso <strong>admin</strong> a todos os clientes automaticamente.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-xs">
                Role padrão: <strong>{user.global_role}</strong>. Clientes sem override herdam este role.
              </AlertDescription>
            </Alert>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Buscar cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Client list */}
          <div className="space-y-1">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-36" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado</p>
            ) : (
              filtered.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-muted/40 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.status}</p>
                  </div>
                  <Select
                    value={getClientValue(client.id)}
                    onValueChange={(val) => handleChange(client.id, val)}
                    disabled={updateAccess.isPending || removeAccess.isPending}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit" className="text-xs">
                        Herdar global ({user.global_role})
                      </SelectItem>
                      <SelectItem value="viewer" className="text-xs">viewer</SelectItem>
                      <SelectItem value="analyst" className="text-xs">analyst</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
