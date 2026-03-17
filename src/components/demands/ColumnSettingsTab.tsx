import { useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GripVertical, Plus, Trash2, Play, Flag } from "lucide-react";
import { useTicketColumns } from "@/hooks/useDemands";
import {
  useAddColumn, useRenameColumn, useReorderColumns, useDeleteColumn,
  type ColumnHasTicketsError,
} from "@/hooks/useManageColumns";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

const PRESET_COLORS = ["#6B7280", "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4", "#10B981", "#EF4444"];

function SortableColumnRow({
  column,
  onRename,
  onDelete,
}: {
  column: Tables<"ticket_columns">;
  onRename: (id: string, name: string) => void;
  onDelete: (col: Tables<"ticket_columns">) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2",
        isDragging && "shadow-lg"
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div
        className="h-4 w-4 rounded-full shrink-0 border"
        style={{ backgroundColor: column.color ?? "#6B7280" }}
      />

      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (name.trim() && name !== column.name) onRename(column.id, name.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              if (name.trim() && name !== column.name) onRename(column.id, name.trim());
            }
          }}
          className="h-7 text-sm flex-1"
          autoFocus
        />
      ) : (
        <span
          className="text-sm font-medium flex-1 cursor-pointer hover:underline"
          onClick={() => setEditing(true)}
        >
          {column.name}
        </span>
      )}

      <div className="flex items-center gap-1.5">
        {column.triggers_started_at && (
          <Badge variant="outline" className="text-xs gap-0.5">
            <Play className="h-3 w-3" /> Início
          </Badge>
        )}
        {column.triggers_finished_at && (
          <Badge variant="outline" className="text-xs gap-0.5">
            <Flag className="h-3 w-3" /> Fim
          </Badge>
        )}
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => onDelete(column)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ColumnSettingsTab() {
  const { data: columns = [] } = useTicketColumns();
  const addMutation = useAddColumn();
  const renameMutation = useRenameColumn();
  const reorderMutation = useReorderColumns();
  const deleteMutation = useDeleteColumn();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  // Delete with protection
  const [deleteTarget, setDeleteTarget] = useState<Tables<"ticket_columns"> | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [moveToId, setMoveToId] = useState("");
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showSimpleDelete, setShowSimpleDelete] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(columns, oldIndex, newIndex);
    const updates = reordered.map((c, i) => ({ id: c.id, position: i + 1 }));
    reorderMutation.mutate({ updates });
  };

  const handleRename = (id: string, name: string) => {
    renameMutation.mutate({ id, name });
  };

  const handleDelete = (col: Tables<"ticket_columns">) => {
    setDeleteTarget(col);
    deleteMutation.mutate(
      { id: col.id },
      {
        onError: (err) => {
          if (typeof err === "object" && err !== null && "code" in err && (err as ColumnHasTicketsError).code === "COLUMN_HAS_TICKETS") {
            setTicketCount((err as ColumnHasTicketsError).count);
            setMoveToId(columns.find((c) => c.id !== col.id)?.id ?? "");
            setShowMoveDialog(true);
          }
        },
        onSuccess: () => setDeleteTarget(null),
      }
    );
  };

  const handleMoveAndDelete = () => {
    if (!deleteTarget || !moveToId) return;
    deleteMutation.mutate(
      { id: deleteTarget.id, moveTicketsTo: moveToId },
      {
        onSuccess: () => {
          setShowMoveDialog(false);
          setDeleteTarget(null);
        },
      }
    );
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMutation.mutate(
      { name: newName.trim(), position: columns.length + 1, color: newColor },
      { onSuccess: () => setNewName("") }
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Colunas do Board</CardTitle>
          <CardDescription>
            Arraste para reordenar, clique no nome para editar. Colunas com tickets não podem ser excluídas diretamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {columns.map((col) => (
                <SortableColumnRow
                  key={col.id}
                  column={col}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add new column */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    newColor === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova coluna..."
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addMutation.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Move tickets dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Coluna tem {ticketCount} ticket(s)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Mova os tickets para outra coluna antes de excluir.
          </p>
          <Select value={moveToId} onValueChange={setMoveToId}>
            <SelectTrigger><SelectValue placeholder="Mover para..." /></SelectTrigger>
            <SelectContent>
              {columns
                .filter((c) => c.id !== deleteTarget?.id)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleMoveAndDelete} disabled={!moveToId}>
              Mover e Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
