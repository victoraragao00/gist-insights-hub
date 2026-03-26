import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Loader2 } from "lucide-react";
import { useMeetingAgendas, type MeetingAgendaWithClient } from "@/hooks/useMeetingAgendas";
import { CreateAgendaDialog } from "@/components/agendas/CreateAgendaDialog";
import { AgendaDetailSheet } from "@/components/agendas/AgendaDetailSheet";
import { SatisfactionDisplay } from "@/components/agendas/SatisfactionPicker";

export function ClientAgendasTab({ clientId }: { clientId: string }) {
  const { data: agendas = [], isLoading } = useMeetingAgendas(clientId);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{agendas.length} pauta(s)</p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Nova Pauta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : agendas.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma pauta para este cliente</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {agendas.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow border border-border" onClick={() => { setSelectedId(a.id); setSheetOpen(true); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{a.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.meeting_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    {a.location && ` · ${a.location}`}
                  </span>
                </div>
                {a.ai_processed && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 shrink-0">✨ IA</Badge>
                )}
                <SatisfactionDisplay score={a.satisfaction_score} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateAgendaDialog open={createOpen} onOpenChange={setCreateOpen} defaultClientId={clientId} />
      <AgendaDetailSheet agendaId={selectedId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
