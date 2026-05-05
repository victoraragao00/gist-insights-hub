import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllSquads, useCreateSquad, useUpdateSquad, useDeleteSquad,
  useAddSquadMember, useRemoveSquadMember, type SquadRow,
} from "@/hooks/useSquads";

const PRESET_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#6B7280"];

export function SquadsSettingsTab() {
  const { data: squads = [] } = useAllSquads();
  const createSquad = useCreateSquad();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const { data: squadCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["squad_demand_counts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("squad_id")
        .not("squad_id", "is", null)
        .limit(1000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.squad_id) counts[row.squad_id] = (counts[row.squad_id] || 0) + 1;
      }
      return counts;
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    const maxPos = squads.reduce((max, s) => Math.max(max, s.position), 0);
    createSquad.mutate(
      { name: newName.trim(), color: newColor, position: maxPos + 1 },
      { onSuccess: () => setNewName("") },
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Squads (workspace TECH)</CardTitle>
          <CardDescription>Gerencie squads e membros para organização do Kanban TECH.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do squad"
              className="flex-1 h-9"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: newColor === c ? "hsl(var(--foreground))" : "transparent" }}
                />
              ))}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createSquad.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Membros</TableHead>
                <TableHead className="text-right">Demandas</TableHead>
                <TableHead className="w-32">Ativo</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {squads.map((squad) => (
                <SquadRowComponent
                  key={squad.id}
                  squad={squad}
                  count={squadCounts[squad.id] ?? 0}
                />
              ))}
              {squads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum squad cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SquadRowComponent({ squad, count }: { squad: SquadRow; count: number }) {
  const updateSquad = useUpdateSquad();
  const deleteSquad = useDeleteSquad();
  const addMember = useAddSquadMember();
  const removeMember = useRemoveSquadMember();

  const [name, setName] = useState(squad.name);
  const [memberToAdd, setMemberToAdd] = useState("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ["user_profiles_active"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberIds = useMemo(
    () => new Set(squad.squad_members.map((m) => m.user_id)),
    [squad.squad_members],
  );
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <TableRow>
      <TableCell>
        <div className="flex gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateSquad.mutate({ id: squad.id, fields: { color: c } })}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{ backgroundColor: c, borderColor: squad.color === c ? "hsl(var(--foreground))" : "transparent" }}
            />
          ))}
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== squad.name) updateSquad.mutate({ id: squad.id, fields: { name: name.trim() } }); }}
          className="h-7 text-sm border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 flex-wrap">
          {squad.squad_members.map((m) => (
            <span key={m.user_id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              {m.user_profiles?.full_name ?? m.user_profiles?.email ?? "?"}
              <button
                type="button"
                onClick={() => removeMember.mutate({ squadId: squad.id, userId: m.user_id })}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover membro"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {availableUsers.length > 0 && (
            <Select
              value={memberToAdd}
              onValueChange={(v) => {
                if (!v) return;
                addMember.mutate({ squadId: squad.id, userId: v });
                setMemberToAdd("");
              }}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="+ Adicionar" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{count}</TableCell>
      <TableCell>
        <Switch
          checked={squad.active}
          onCheckedChange={(checked) => updateSquad.mutate({ id: squad.id, fields: { active: checked } })}
        />
      </TableCell>
      <TableCell>
        {count === 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir squad "{squad.name}"?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteSquad.mutate(squad.id)}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  );
}
