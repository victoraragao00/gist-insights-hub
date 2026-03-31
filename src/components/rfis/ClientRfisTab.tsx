import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRfisByClient } from "@/hooks/useRfis";
import { RfiDetailSheet } from "./RfiDetailSheet";

interface ClientRfisTabProps {
  clientId: string;
  clientName?: string;
}

export function ClientRfisTab({ clientId, clientName }: ClientRfisTabProps) {
  const { data: rfis = [], isLoading } = useRfisByClient(clientId);
  const [selectedRfi, setSelectedRfi] = useState<(typeof rfis)[number] | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (rfis.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma RFI vinculada a este cliente
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Número</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead>Demanda</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="w-28 text-right">Valor</TableHead>
            <TableHead className="w-28">Vencimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rfis.map((rfi) => (
            <TableRow
              key={rfi.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => setSelectedRfi(rfi)}
            >
              <TableCell className="font-mono text-xs">{rfi.rfi_number}</TableCell>
              <TableCell className="text-sm">{rfi.subject ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {(rfi.demands as { title: string } | null)?.title ?? "—"}
              </TableCell>
              <TableCell>
                {rfi.rfi_statuses ? (
                  <Badge
                    className="text-white text-xs"
                    style={{ backgroundColor: (rfi.rfi_statuses as { color: string | null }).color ?? undefined }}
                  >
                    {(rfi.rfi_statuses as { name: string }).name}
                  </Badge>
                ) : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {(rfi.user_profiles as { full_name: string | null; email: string | null } | null)?.full_name ??
                  (rfi.user_profiles as { email: string | null } | null)?.email ?? "—"}
              </TableCell>
              <TableCell className="text-right text-sm">
                {rfi.budget_value != null
                  ? Number(rfi.budget_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {rfi.due_date
                  ? new Date(rfi.due_date + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedRfi && (
        <RfiDetailSheet
          open={!!selectedRfi}
          onOpenChange={(o) => { if (!o) setSelectedRfi(null); }}
          rfi={selectedRfi as Parameters<typeof RfiDetailSheet>[0]["rfi"]}
          demandTitle={(selectedRfi.demands as { title: string } | null)?.title}
          clientName={clientName}
        />
      )}
    </>
  );
}
