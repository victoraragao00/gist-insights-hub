import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardList, Loader2 } from "lucide-react";
import { useMeetingAgendas, type MeetingAgendaWithClient } from "@/hooks/useMeetingAgendas";
import { useClient } from "@/context/ClientContext";
import { CreateAgendaDialog } from "@/components/agendas/CreateAgendaDialog";
import { AgendaDetailSheet } from "@/components/agendas/AgendaDetailSheet";
import { SatisfactionDisplay } from "@/components/agendas/SatisfactionPicker";

const AgendasPage = () => {
  const { clients } = useClient();
  const [filterClientId, setFilterClientId] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterSatisfaction, setFilterSatisfaction] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: agendas = [], isLoading } = useMeetingAgendas({
    clientId: filterClientId && filterClientId !== "all" ? filterClientId : undefined,
    periodDays: filterPeriod ? Number(filterPeriod) : undefined,
    satisfactionScore: filterSatisfaction ? Number(filterSatisfaction) : undefined,
  });

  const handleOpen = (agenda: MeetingAgendaWithClient) => {
    setSelectedAgendaId(agenda.id);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pautas de Reunião</h1>
          <p className="text-sm text-muted-foreground">Gerencie pautas, transcrições e lições de casa</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Pauta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterClientId} onValueChange={setFilterClientId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSatisfaction} onValueChange={setFilterSatisfaction}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Satisfação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="1">😡 1</SelectItem>
            <SelectItem value="2">😕 2</SelectItem>
            <SelectItem value="3">😐 3</SelectItem>
            <SelectItem value="4">🙂 4</SelectItem>
            <SelectItem value="5">🤩 5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : agendas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhuma pauta encontrada</p>
          <p className="text-sm">Crie uma nova pauta para começar</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {agendas.map((agenda, i) => (
            <Card
              key={agenda.id}
              className="cursor-pointer transition-shadow duration-200 hover:shadow-md border border-border animate-fade-in-up"
              onClick={() => handleOpen(agenda)}
              style={{ animationDelay: `${i * 40}ms`, opacity: 0 }}
              // Limit stagger to 10 items per design system
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{agenda.title}</span>
                    {agenda.ai_processed && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                        ✨ IA
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{agenda.clients?.name ?? "—"}</span>
                    <span>
                      {new Date(agenda.meeting_date).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </span>
                    {agenda.location && <span>· {agenda.location}</span>}
                  </div>
                </div>
                <SatisfactionDisplay score={agenda.satisfaction_score} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateAgendaDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AgendaDetailSheet agendaId={selectedAgendaId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
};

export default AgendasPage;
