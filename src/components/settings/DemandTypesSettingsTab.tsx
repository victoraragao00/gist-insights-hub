import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Loader2, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type DemandType = Tables<"demand_types">;

export function DemandTypesSettingsTab() {
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useQuery({
    queryKey: ["demand_types_admin"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_types")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as DemandType[];
    },
  });

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#7C3AED");
  const [newIcon, setNewIcon] = useState("");

  const upsert = useMutation({
    mutationFn: async (input: Partial<DemandType> & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase.from("demand_types").update(input).eq("id", input.id);
        if (error) throw error;
      } else {
        const maxPos = Math.max(0, ...types.map((t) => t.position ?? 0));
        const { error } = await supabase.from("demand_types").insert({
          name: input.name ?? "",
          color: input.color ?? null,
          icon: input.icon ?? null,
          active: true,
          position: maxPos + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demand_types_admin"] });
      qc.invalidateQueries({ queryKey: ["demand_types"] });
      toast.success("Tipo salvo");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = types.findIndex((t) => t.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= types.length) return;
      const a = types[idx], b = types[target];
      const { error: e1 } = await supabase.from("demand_types").update({ position: b.position }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("demand_types").update({ position: a.position }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demand_types_admin"] });
      qc.invalidateQueries({ queryKey: ["demand_types"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao reordenar"),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tipos de demanda</CardTitle>
          <CardDescription>
            Configure os tipos disponíveis ao criar uma demanda. Desativados não aparecem em novos formulários.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Bug" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cor</Label>
              <Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-14 h-9 p-1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ícone</Label>
              <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="🐛" className="w-20" />
            </div>
            <Button
              size="sm"
              disabled={!newName.trim() || upsert.isPending}
              onClick={() => {
                upsert.mutate(
                  { name: newName.trim(), color: newColor, icon: newIcon || null },
                  {
                    onSuccess: () => {
                      setNewName(""); setNewIcon("");
                    },
                  }
                );
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-20">Cor</TableHead>
                  <TableHead className="w-20">Ícone</TableHead>
                  <TableHead className="w-20">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t, idx) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => reorder.mutate({ id: t.id, dir: -1 })}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === types.length - 1} onClick={() => reorder.mutate({ id: t.id, dir: 1 })}>
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
                          if (v && v !== t.name) upsert.mutate({ id: t.id, name: v });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        defaultValue={t.color ?? "#7C3AED"}
                        className="w-14 h-8 p-1"
                        onChange={(e) => upsert.mutate({ id: t.id, color: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={t.icon ?? ""}
                        className="h-8 w-16"
                        onBlur={(e) => {
                          if (e.target.value !== (t.icon ?? "")) upsert.mutate({ id: t.id, icon: e.target.value || null });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={t.active ?? true}
                        onCheckedChange={(v) => upsert.mutate({ id: t.id, active: v })}
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
