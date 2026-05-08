import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRfisByProject, useCreateRfi, useRfiStatuses } from "@/hooks/useRfis";
import { RfiDetailSheet } from "@/components/rfis/RfiDetailSheet";

interface Props {
  projectId: string;
  canCreate: boolean;
}

export function ProjectRfisTab({ projectId, canCreate }: Props) {
  const { data: rfis = [], isLoading } = useRfisByProject(projectId);
  const { data: statuses = [] } = useRfiStatuses();
  const createRfi = useCreateRfi();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleCreate = () => {
    createRfi.mutate({ project_id: projectId, status_id: statuses[0]?.id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rfis.length} RFI{rfis.length !== 1 ? "s" : ""} vinculada{rfis.length !== 1 ? "s" : ""} a este projeto
        </p>
        {canCreate && (
          <Button size="sm" onClick={handleCreate} disabled={createRfi.isPending}>
            {createRfi.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            Nova RFI
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rfis.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Nenhuma RFI vinculada ainda.
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Código</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Assunto</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Criada</th>
              </tr>
            </thead>
            <tbody>
              {rfis.map((rfi) => {
                const status = rfi.rfi_statuses as { name: string; color: string | null } | null;
                const assignee = rfi.user_profiles as { full_name: string | null; email: string | null } | null;
                return (
                  <tr
                    key={rfi.id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer last:border-0"
                    onClick={() => setSelectedId(rfi.id)}
                  >
                    <td className="py-2.5 px-3 font-mono text-xs font-medium">{rfi.rfi_number}</td>
                    <td className="py-2.5 px-3 max-w-xs truncate">{rfi.subject ?? "—"}</td>
                    <td className="py-2.5 px-3">
                      {status ? (
                        <Badge variant="outline" style={status.color ? { borderColor: status.color, color: status.color } : undefined}>
                          {status.name}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">
                      {assignee?.full_name ?? assignee?.email ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">
                      {rfi.created_at ? format(new Date(rfi.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (() => {
        const sel = rfis.find((r) => r.id === selectedId);
        if (!sel) return null;
        return (
          <RfiDetailSheet
            open={!!selectedId}
            onOpenChange={(o) => { if (!o) setSelectedId(null); }}
            rfi={sel as Parameters<typeof RfiDetailSheet>[0]["rfi"]}
          />
        );
      })()}
    </div>
  );
}
