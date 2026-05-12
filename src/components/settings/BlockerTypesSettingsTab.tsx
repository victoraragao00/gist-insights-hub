import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Loader2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  useAllBlockerTypes,
  useCreateBlockerType,
  useUpdateBlockerType,
} from "@/hooks/useBlockerTypes";

export function BlockerTypesSettingsTab() {
  const { data: types = [], isLoading } = useAllBlockerTypes();
  const createMut = useCreateBlockerType();
  const updateMut = useUpdateBlockerType();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#E24B4A");
  const [newIcon, setNewIcon] = useState("🔒");
  const [newRequiresReason, setNewRequiresReason] = useState(false);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const maxPos = types.reduce((acc, t) => Math.max(acc, t.position ?? 0), 0);
    createMut.mutate(
      {
        name,
        color: newColor,
        icon: newIcon || "🔒",
        position: maxPos + 1,
        requires_reason: newRequiresReason,
      },
      {
        onSuccess: () => {
          setNewName("");
          setNewIcon("🔒");
          setNewColor("#E24B4A");
          setNewRequiresReason(false);
        },
      }
    );
  };

  const reorder = (id: string, dir: -1 | 1) => {
    const idx = types.findIndex((t) => t.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= types.length) return;
    const a = types[idx];
    const b = types[target];
    Promise.all([
      updateMut.mutateAsync({ id: a.id, fields: { position: b.position } }),
      updateMut.mutateAsync({ id: b.id, fields: { position: a.position } }),
    ]).catch((err) =>
      toast.error("Erro ao reordenar: " + (err instanceof Error ? err.message : "Erro"))
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tipos de bloqueio</CardTitle>
          <CardDescription>
            Configure os tipos disponíveis ao marcar uma demanda como bloqueada. Marque "Exige motivo" para forçar o preenchimento de uma justificativa (ex.: "Outro").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px] space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Aguardando cliente" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor</Label>
              <Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-14 h-9 p-1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ícone</Label>
              <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="🔒" className="w-20" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Exige motivo</Label>
              <div className="h-9 flex items-center">
                <Switch checked={newRequiresReason} onCheckedChange={setNewRequiresReason} />
              </div>
            </div>
            <Button size="sm" disabled={!newName.trim() || createMut.isPending} onClick={handleAdd}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-20">Cor</TableHead>
                  <TableHead className="w-20">Ícone</TableHead>
                  <TableHead className="w-28">Exige motivo</TableHead>
                  <TableHead className="w-20">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => reorder(t.id, -1)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === types.length - 1} onClick={() => reorder(t.id, 1)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={t.name}
                        className="h-8"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== t.name) {
                            updateMut.mutate({ id: t.id, fields: { name: v } }, {
                              onSuccess: () => toast.success("Tipo atualizado"),
                            });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        defaultValue={t.color}
                        className="w-14 h-8 p-1"
                        onChange={(e) => updateMut.mutate({ id: t.id, fields: { color: e.target.value } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={t.icon}
                        className="h-8 w-16"
                        onBlur={(e) => {
                          if (e.target.value !== t.icon) {
                            updateMut.mutate({ id: t.id, fields: { icon: e.target.value || "🔒" } });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={t.requires_reason ?? false}
                        onCheckedChange={(v) => updateMut.mutate({ id: t.id, fields: { requires_reason: v } }, {
                          onSuccess: () => toast.success(v ? "Motivo passou a ser obrigatório" : "Motivo passou a ser opcional"),
                        })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={t.active}
                        onCheckedChange={(v) => updateMut.mutate({ id: t.id, fields: { active: v } }, {
                          onSuccess: () => toast.success(v ? "Tipo reativado" : "Tipo desativado"),
                        })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
