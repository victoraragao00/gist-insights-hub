import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateProject } from "@/hooks/useProjects";
import { useClient } from "@/context/ClientContext";
import { useWorkspace } from "@/hooks/useWorkspace";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const { clients } = useClient();
  const { activeWorkspace } = useWorkspace();
  const create = useCreateProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [isInternal, setIsInternal] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      client_id: isInternal ? null : (clientId || null),
      workspace: isInternal ? "tech" : activeWorkspace,
      is_internal: isInternal,
    });
    setTitle(""); setDescription(""); setDueDate(""); setClientId(""); setIsInternal(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-title">Título *</Label>
            <Input id="proj-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Descrição</Label>
            <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Switch id="is-internal" checked={isInternal} onCheckedChange={setIsInternal} />
            <div className="flex-1">
              <label htmlFor="is-internal" className="text-sm font-medium cursor-pointer">
                Projeto interno (uMode)
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sem cliente externo — projeto exclusivo da uMode
              </p>
            </div>
            {isInternal && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900 font-medium">
                Interno
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!isInternal && (
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="proj-due">Data de entrega</Label>
              <Input id="proj-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!title.trim() || create.isPending}>
            Criar projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
