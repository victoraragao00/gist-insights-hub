import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAllRfis, useRfiStatuses } from "@/hooks/useRfis";
import { useClient } from "@/context/ClientContext";

const ALL = "__all__";

type WorkspaceFilter = undefined | "tech" | "cx";

const WORKSPACE_OPTIONS: { value: WorkspaceFilter; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "cx", label: "Operação" },
  { value: "tech", label: "TECH" },
];

export default function RFIsPage() {
  const navigate = useNavigate();
  const { clients } = useClient();
  const { data: statuses = [] } = useRfiStatuses();

  const [search, setSearch] = useState("");
  const [statusId, setStatusId] = useState<string>(ALL);
  const [clientId, setClientId] = useState<string>(ALL);
  const [workspace, setWorkspace] = useState<WorkspaceFilter>(undefined);

  const { data: rfis = [], isLoading } = useAllRfis({
    search: search || undefined,
    statusId: statusId === ALL ? undefined : statusId,
    clientId: clientId === ALL ? undefined : clientId,
    workspace,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold mb-4">RFIs</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Buscar por código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-56"
          />
          <Select value={statusId} onValueChange={setStatusId}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            {WORKSPACE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setWorkspace(opt.value)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-all",
                  workspace === opt.value
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rfis.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum RFI encontrado
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Código</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Demanda</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Workspace</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável</th>
                <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Criado</th>
              </tr>
            </thead>
            <tbody>
              {rfis.map((rfi) => {
                const demand = rfi.demands as { id: string; title: string; workspace?: string; clients?: { name: string } | null } | null;
                const status = rfi.rfi_statuses;
                const assignee = rfi.user_profiles;
                const isTech = demand?.workspace === "tech";
                return (
                  <tr
                    key={rfi.id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                    onClick={() => demand && navigate(`/demands/${demand.id}`)}
                  >
                    <td className="py-3 font-mono text-xs font-medium">{rfi.rfi_number}</td>
                    <td className="py-3 max-w-xs truncate">{demand?.title ?? "—"}</td>
                    <td className="py-3 text-muted-foreground">{demand?.clients?.name ?? "—"}</td>
                    <td className="py-3">
                      <span className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full border font-medium",
                        isTech
                          ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900"
                          : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900",
                      )}>
                        {isTech ? "TECH" : "Operação"}
                      </span>
                    </td>
                    <td className="py-3">
                      {status ? (
                        <Badge
                          variant="outline"
                          style={status.color ? { borderColor: status.color, color: status.color } : undefined}
                        >
                          {status.name}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">
                      {assignee?.full_name ?? assignee?.email ?? "—"}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">
                      {rfi.created_at ? format(new Date(rfi.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
