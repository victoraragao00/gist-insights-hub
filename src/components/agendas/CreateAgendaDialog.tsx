import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useAgendaFieldConfig, type FieldVisibility, type AgendaFieldConfig } from "@/hooks/useAgendaFieldConfig";
import { useClient } from "@/context/ClientContext";
import { SatisfactionPicker } from "./SatisfactionPicker";

interface CreateAgendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId?: string;
}

export function CreateAgendaDialog({ open, onOpenChange, defaultClientId }: CreateAgendaDialogProps) {
  const { clients } = useClient();
  const { data: fieldConfig } = useAgendaFieldConfig();
  const createMutation = useCreateAgenda();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [meetingDate, setMeetingDate] = useState("");
  const [location, setLocation] = useState("");
  const [objective, setObjective] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null);
  const [nextSteps, setNextSteps] = useState("");

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
    (!isRequired("objective") || objective.trim().length > 0) &&
    (!isRequired("satisfaction_score") || satisfactionScore !== null);

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        client_id: clientId,
        meeting_date: new Date(meetingDate).toISOString(),
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
    setTitle("");
    setClientId(defaultClientId ?? "");
    setMeetingDate("");
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
