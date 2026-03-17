import { useState, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, ArrowRightLeft, User, Lock, Unlock, Edit, Trash2, Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useTicketColumns, useDemandTypes, useDemandActivities,
  useUpdateDemand, useMoveDemand, useDeleteDemand,
  type DemandRow, type DemandPriority,
} from "@/hooks/useDemands";
import type { Tables } from "@/integrations/supabase/types";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  moved: ArrowRightLeft,
  assigned: User,
  blocked: Lock,
  unblocked: Unlock,
  edited: Edit,
};

interface DemandDetailSheetProps {
  demand: DemandRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemandDetailSheet({ demand, open, onOpenChange }: DemandDetailSheetProps) {
  if (!demand) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Detalhes da Demanda</SheetTitle>
        </SheetHeader>
        <DemandDetailContent demand={demand} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function DemandDetailContent({ demand, onClose }: { demand: DemandRow; onClose: () => void }) {
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: activities = [] } = useDemandActivities(demand.id);
  const updateMutation = useUpdateDemand();
  const moveMutation = useMoveDemand();
  const deleteMutation = useDeleteDemand();

  const [title, setTitle] = useState(demand.title);
  const [description, setDescription] = useState(demand.description ?? "");
  const [expectedResult, setExpectedResult] = useState(demand.expected_result ?? "");
  const [notes, setNotes] = useState(demand.notes ?? "");
  const [assignee, setAssignee] = useState(demand.assignee ?? "");

  const saveField = useCallback((field: string, value: string, label: string) => {
    updateMutation.mutate({ id: demand.id, fields: { [field]: value || null }, fieldLabel: label });
  }, [demand.id, updateMutation]);

  const handleColumnChange = (newColumnId: string) => {
    const targetCol = columns.find((c) => c.id === newColumnId);
    if (!targetCol) return;
    moveMutation.mutate({
      demandId: demand.id,
      targetColumnId: newColumnId,
      targetPosition: 0,
      sourceColumnName: demand.ticket_columns?.name ?? "",
      targetColumnName: targetCol.name,
      currentStartedAt: demand.started_at,
      targetTriggersStartedAt: targetCol.triggers_started_at ?? false,
      targetTriggersFinishedAt: targetCol.triggers_finished_at ?? false,
    });
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== demand.title) saveField("title", title.trim(), "Título");
        }}
        className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 shadow-none"
      />

      {/* Meta */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select
            value={demand.demand_type_id}
            onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { demand_type_id: v }, fieldLabel: "Tipo" })}
          >
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Prioridade</Label>
          <Select
            value={demand.priority}
            onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { priority: v }, fieldLabel: "Prioridade" })}
          >
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Coluna</Label>
          <Select value={demand.column_id} onValueChange={handleColumnChange}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            onBlur={() => {
              if (assignee !== (demand.assignee ?? "")) saveField("assignee", assignee, "Responsável");
            }}
            className="h-8"
            placeholder="—"
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Cliente: <span className="font-medium text-foreground">{demand.clients?.name ?? "—"}</span>
      </div>

      <Separator />

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Descrição</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (demand.description ?? "")) saveField("description", description, "Descrição");
          }}
          rows={3}
        />
      </div>

      {/* Expected Result */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Resultado Esperado</Label>
        <Textarea
          value={expectedResult}
          onChange={(e) => setExpectedResult(e.target.value)}
          onBlur={() => {
            if (expectedResult !== (demand.expected_result ?? "")) saveField("expected_result", expectedResult, "Resultado Esperado");
          }}
          rows={2}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Notas Internas</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (demand.notes ?? "")) saveField("notes", notes, "Notas");
          }}
          rows={2}
        />
      </div>

      <Separator />

      {/* Timeline */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Atividades</Label>
        {activities.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma atividade registrada</p>
        )}
        {activities.map((act: Tables<"demand_activities">) => {
          const Icon = EVENT_ICONS[act.event_type] ?? Edit;
          return (
            <div key={act.id} className="flex gap-2 items-start text-xs">
              <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-foreground">{act.description}</span>
                {act.created_at && (
                  <span className="text-muted-foreground ml-1.5">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-full">
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Demanda
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A demanda e todas as atividades serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate(demand.id, { onSuccess: onClose });
              }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
