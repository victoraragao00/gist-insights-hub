import { useState, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, FileText, ArrowRight, Loader2, Trash2, Sparkles, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/demands/RichTextEditor";
import { CreateDemandDialog } from "@/components/demands/CreateDemandDialog";
import {
  useProjectBacklog,
  useCreateBacklogItem,
  useUpdateBacklogItem,
  useDeleteBacklogItem,
  useMarkBacklogConverted,
  type BacklogItem,
  type BacklogStatus,
} from "@/hooks/useProjectBacklog";

interface Props {
  projectId: string;
  clientId: string | null | undefined;
  workspace?: "cx" | "tech";
}

const STATUS_LABEL: Record<BacklogStatus, string> = {
  open: "Aberto",
  converted: "Convertido",
  discarded: "Descartado",
};

const STATUS_STYLES: Record<BacklogStatus, string> = {
  open: "bg-muted text-muted-foreground",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  discarded: "bg-muted text-muted-foreground line-through",
};

export function ProjectBacklogTab({ projectId, clientId, workspace = "tech" }: Props) {
  const { data: items = [], isLoading } = useProjectBacklog(projectId);
  const createItem = useCreateBacklogItem(projectId);
  const updateItem = useUpdateBacklogItem(projectId);
  const deleteItem = useDeleteBacklogItem(projectId);
  const markConverted = useMarkBacklogConverted(projectId);

  const [filter, setFilter] = useState<BacklogStatus | "all">("open");
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<BacklogItem | null>(null);
  const [convertingItem, setConvertingItem] = useState<BacklogItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const handleCreate = () => {
    const t = newTitle.trim();
    if (!t) return;
    const maxPos = items.reduce((m, i) => Math.max(m, i.position), 0);
    createItem.mutate(
      { title: t, position: maxPos + 1 },
      { onSuccess: () => setNewTitle("") },
    );
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    updateItem.mutate(
      { id: editing.id, title: editing.title, notes: editing.notes },
      { onSuccess: () => setEditing(null) },
    );
  };

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!clientId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
        O backlog converte tópicos em demandas, e demandas precisam de um cliente.
        Este projeto não possui cliente vinculado, então a conversão está indisponível.
        Você ainda pode usar a aba <strong>Documentos</strong> para registrar escopo e notas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {(["open", "converted", "discarded", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {s === "all" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* New topic input */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Novo tópico... (Enter para adicionar)"
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={!newTitle.trim() || createItem.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          {filter === "open"
            ? "Nenhum tópico aberto. Adicione algo que ainda vai virar demanda."
            : `Nenhum tópico ${STATUS_LABEL[filter as BacklogStatus]?.toLowerCase() ?? ""}.`}
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {filtered.map((item) => {
            const isConverted = item.status === "converted";
            const isDiscarded = item.status === "discarded";
            const isOpen = item.status === "open";
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 group">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex-1 min-w-0 text-left flex items-center gap-2"
                  disabled={!isOpen}
                >
                  {item.notes && <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className={cn("text-sm truncate", isDiscarded && "text-muted-foreground line-through")}>
                    {item.title}
                  </span>
                </button>

                <Badge className={cn("text-[10px] border-0 shrink-0", STATUS_STYLES[item.status])}>
                  {STATUS_LABEL[item.status]}
                </Badge>

                {isConverted && item.converted_demand_id && (
                  <RouterLink
                    to={`/demands/${item.converted_demand_id}`}
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline shrink-0"
                  >
                    Ver demanda <ArrowRight className="h-3 w-3" />
                  </RouterLink>
                )}

                {isOpen && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConvertingItem(item)}
                    className="shrink-0 h-7 text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Converter em demanda
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isOpen && (
                      <DropdownMenuItem onClick={() => setEditing(item)}>
                        Editar
                      </DropdownMenuItem>
                    )}
                    {isOpen && (
                      <DropdownMenuItem
                        onClick={() => updateItem.mutate({ id: item.id, status: "discarded" })}
                      >
                        <Ban className="h-3.5 w-3.5 mr-2" /> Descartar
                      </DropdownMenuItem>
                    )}
                    {isDiscarded && (
                      <DropdownMenuItem
                        onClick={() => updateItem.mutate({ id: item.id, status: "open" })}
                      >
                        Reabrir
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir tópico?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{item.title}" será removido permanentemente. Demandas convertidas
                            não são afetadas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteItem.mutate(item.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar tópico</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <RichTextEditor
                  value={editing.notes ?? ""}
                  onSave={(html) => setEditing({ ...editing, notes: html })}
                  uploadPathPrefix={`demands/_drafts/proj-${projectId}/inline`}
                  minHeight={160}
                  placeholder="Detalhes, links, contexto. Cole imagens diretamente."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateItem.isPending}>
              {updateItem.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to demand */}
      {convertingItem && clientId && (
        <CreateDemandDialog
          open={!!convertingItem}
          onOpenChange={(v) => { if (!v) setConvertingItem(null); }}
          defaultClientId={clientId}
          defaultProjectId={projectId}
          defaultTitle={convertingItem.title}
          defaultDescriptionHtml={convertingItem.notes ?? ""}
          workspace={workspace}
          onCreated={(demandId) => {
            markConverted.mutate({ id: convertingItem.id, demandId });
            setConvertingItem(null);
          }}
        />
      )}
    </div>
  );
}
