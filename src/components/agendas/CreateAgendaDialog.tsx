import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateAgenda } from "@/hooks/useMeetingAgendas";
import { useCompatibleProjects } from "@/hooks/useProjects";
import { useAgendaFieldConfig, type AgendaFieldConfig } from "@/hooks/useAgendaFieldConfig";
import { useClient } from "@/context/ClientContext";
import { SatisfactionPicker } from "./SatisfactionPicker";

interface CreateAgendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId?: string;
}

type AgendaKind = "client" | "internal";

export function CreateAgendaDialog({ open, onOpenChange, defaultClientId }: CreateAgendaDialogProps) {
  const { clients } = useClient();
  const { data: fieldConfig } = useAgendaFieldConfig();
  const createMutation = useCreateAgenda();

  const [agendaType, setAgendaType] = useState<AgendaKind>("client");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [meetingDate, setMeetingDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [location, setLocation] = useState("");
  const [objective, setObjective] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null);
  const [nextSteps, setNextSteps] = useState("");

  const { data: compatibleProjects = [] } = useCompatibleProjects(clientId || null, agendaType);
  const projects = useMemo(() => compatibleProjects, [compatibleProjects]);

  // Reset selected project if it no longer matches client
  useEffect(() => {
    if (!projectId) return;
    if (!projects.some((p) => p.id === projectId)) setProjectId(null);
  }, [projects, projectId]);

  const isVisible = (field: keyof AgendaFieldConfig) => {
    if (!fieldConfig) return true;
    return fieldConfig[field] !== "hidden";
  };

  const isRequired = (field: keyof AgendaFieldConfig) => {
    if (!fieldConfig) return false;
    return fieldConfig[field] === "required";
  };

  const canSubmit =
    title.trim().length > 0 &&
    clientId &&
    meetingDate &&
    durationMinutes >= 15 &&
    (!isRequired("objective") || objective.trim().length > 0) &&
    (!isRequired("satisfaction_score") || satisfactionScore !== null);

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        client_id: clientId,
        meeting_date: new Date(meetingDate).toISOString(),
        duration_minutes: durationMinutes,
        agenda_type: agendaType,
        project_id: agendaType === "internal" ? projectId : null,
        executive_summary: executiveSummary.trim() || undefined,
        location: location || undefined,
        objective: objective || undefined,
        context_notes: contextNotes || undefined,
        satisfaction_score: satisfactionScore ?? undefined,
        next_steps: nextSteps || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setAgendaType("client");
    setTitle("");
    setClientId(defaultClientId ?? "");
    setMeetingDate("");
    setDurationMinutes(60);
    setProjectId(null);
    setExecutiveSummary("");
    setLocation("");
    setObjective("");
    setContextNotes("");
    setSatisfactionScore(null);
    setNextSteps("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Pauta de Reunião</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de pauta</Label>
            <Select value={agendaType} onValueChange={(v) => setAgendaType(v as AgendaKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="internal">Interna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Título {isRequired("title") && "*"}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Revisão mensal do projeto" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da reunião *</Label>
              <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Duração <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={15}
                step={15}
                placeholder="60"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value || "0", 10))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">minutos</span>
              {durationMinutes > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {(durationMinutes / 60).toFixed(1)}h
                </span>
              )}
            </div>
          </div>

          {agendaType === "internal" && (
            <div className="space-y-1.5">
              <Label>
                Projeto <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Select
                value={projectId ?? "none"}
                onValueChange={(v) => setProjectId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a um projeto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum projeto</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="inline-flex items-center gap-2">
                        {p.is_internal && (
                          <span className="text-[10px] px-1.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900">
                            Interno
                          </span>
                        )}
                        <span>{p.title}</span>
                        {p.clients?.name && (
                          <span className="text-muted-foreground text-xs">· {p.clients.name}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Resumo executivo
              <span className="text-xs text-muted-foreground ml-2">(opcional — pode preencher depois)</span>
            </Label>
            <Textarea
              placeholder="Principais pontos da reunião..."
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              rows={3}
            />
          </div>

          {isVisible("location") && (
            <div className="space-y-1.5">
              <Label>Local {isRequired("location") && "*"}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Sala 3 / Google Meet" />
            </div>
          )}

          {isVisible("objective") && (
            <div className="space-y-1.5">
              <Label>Objetivo {isRequired("objective") && "*"}</Label>
              <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} placeholder="Objetivo principal da reunião" />
            </div>
          )}

          {isVisible("context_notes") && (
            <div className="space-y-1.5">
              <Label>Contexto / Notas prévias</Label>
              <Textarea value={contextNotes} onChange={(e) => setContextNotes(e.target.value)} rows={2} placeholder="Contexto relevante para a reunião" />
            </div>
          )}

          {isVisible("satisfaction_score") && (
            <div className="space-y-1.5">
              <Label>Satisfação {isRequired("satisfaction_score") && "*"}</Label>
              <SatisfactionPicker value={satisfactionScore} onChange={setSatisfactionScore} />
            </div>
          )}

          {isVisible("next_steps") && (
            <div className="space-y-1.5">
              <Label>Próximos passos</Label>
              <Textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} rows={2} placeholder="Próximos passos acordados" />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar Pauta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
