import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Check, X } from "lucide-react";
import { useAllRfiStatuses, useManageRfiStatuses } from "@/hooks/useRfis";

export function RfiStatusSettingsTab() {
  const { data: statuses = [], isLoading } = useAllRfiStatuses();
  const { createStatus, updateStatus, deleteStatus } = useManageRfiStatuses();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    const maxPos = statuses.length > 0 ? Math.max(...statuses.map((s) => s.position)) + 1 : 0;
    createStatus.mutate({ name: newName.trim(), color: newColor, position: maxPos }, {
      onSuccess: () => { setNewName(""); setNewColor("#3b82f6"); },
    });
  };

  const startEdit = (s: { id: string; name: string; color: string | null }) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color ?? "#3b82f6");
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateStatus.mutate({ id: editingId, fields: { name: editName.trim(), color: editColor } }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const toggleActive = (id: string, currentActive: boolean | null) => {
    updateStatus.mutate({ id, fields: { active: !currentActive } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status de RFI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create */}
        <div className="flex items-end gap-2">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Nome</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo status" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cor</Label>
            <Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-8 w-14 p-1" />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={createStatus.isPending || !newName.trim()} className="h-8">
            {createStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            <span className="ml-1">Criar</span>
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-20">Cor</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {editingId === s.id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" />
                    ) : (
                      <span className="text-sm">{s.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === s.id ? (
                      <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-7 w-10 p-0.5" />
                    ) : (
                      <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: s.color ?? "#ccc" }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.active ? "default" : "secondary"}
                      className="cursor-pointer text-xs"
                      onClick={() => toggleActive(s.id, s.active)}
                    >
                      {s.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === s.id ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit} disabled={updateStatus.isPending}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => startEdit(s)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
