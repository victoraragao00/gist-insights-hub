import { useState } from "react";
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
import { useCreateDemand, useTicketColumns, useDemandTypes, type DemandPriority } from "@/hooks/useDemands";
import { useClient } from "@/context/ClientContext";

interface CreateDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultColumnId?: string;
}

export function CreateDemandDialog({ open, onOpenChange, defaultColumnId }: CreateDemandDialogProps) {
  const { clients } = useClient();
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const createMutation = useCreateDemand();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [priority, setPriority] = useState<DemandPriority>("medium");
  const [columnId, setColumnId] = useState(defaultColumnId ?? "");
  const [description, setDescription] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");

  // Set default column when columns load
  const effectiveColumnId = columnId || columns[0]?.id || "";

  const canSubmit = title.trim().length > 0 && clientId && typeId;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        client_id: clientId,
        demand_type_id: typeId,
        priority,
        column_id: effectiveColumnId,
        description: description || undefined,
        expected_result: expectedResult || undefined,
        assignee: assignee || undefined,
        notes: notes || undefined,
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
    setClientId("");
    setTypeId("");
    setPriority("medium");
    setColumnId(defaultColumnId ?? "");
    setDescription("");
    setExpectedResult("");
    setAssignee("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Corrigir erro de login" />
          </div>

          {/* Client + Type */}
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
              <Label>Tipo *</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority + Column */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as DemandPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Coluna inicial</Label>
              <Select value={effectiveColumnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Expected Result */}
          <div className="space-y-1.5">
            <Label>Resultado Esperado</Label>
            <Textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} />
          </div>

          {/* Assignee + Notes */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
