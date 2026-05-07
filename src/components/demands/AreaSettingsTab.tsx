import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAllDemandAreas, useManageAreas, type AreaWorkspace } from "@/hooks/useDemandAreas";
import { useQuery } from "@tanstack/react-query";

const PRESET_COLORS = ["#6B7280", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"];
const WORKSPACE_LABELS: Record<AreaWorkspace, string> = {
  cx: "CX",
  tech: "TECH",
  both: "Ambos",
};

export function AreaSettingsTab() {
  const { data: allAreas = [] } = useAllDemandAreas();
  const { addArea, updateArea, deactivateArea, reactivateArea, deleteArea } = useManageAreas();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newWorkspace, setNewWorkspace] = useState<AreaWorkspace>("both");

  const activeAreas = useMemo(() => allAreas.filter((a) => a.active), [allAreas]);
  const inactiveAreas = useMemo(() => allAreas.filter((a) => !a.active), [allAreas]);

  // Count demands per area
  const { data: areaCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["area_demand_counts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("area_id")
        .not("area_id", "is", null)
        .limit(1000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.area_id) counts[row.area_id] = (counts[row.area_id] || 0) + 1;
      }
      return counts;
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    const maxPos = activeAreas.reduce((max, a) => Math.max(max, a.position), 0);
    addArea.mutate({ name: newName.trim(), color: newColor, position: maxPos + 1, workspace: newWorkspace });
    setNewName("");
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Áreas Responsáveis</CardTitle>
          <CardDescription>Gerencie as áreas que podem ser atribuídas a demandas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da área"
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
            <Select value={newWorkspace} onValueChange={(v) => setNewWorkspace(v as AreaWorkspace)}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cx">CX</SelectItem>
                <SelectItem value="tech">TECH</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addArea.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Active areas */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeAreas.map((area) => {
                const count = areaCounts[area.id] ?? 0;
                return (
                  <AreaRow
                    key={area.id}
                    area={area}
                    count={count}
                    onUpdate={(fields) => updateArea.mutate({ id: area.id, fields })}
                    onDeactivate={() => deactivateArea.mutate(area.id)}
                    onDelete={() => deleteArea.mutate(area.id)}
                    isUpdating={updateArea.isPending}
                  />
                );
              })}
              {activeAreas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhuma área ativa
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Inactive areas */}
          {inactiveAreas.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground pt-2">Inativas</p>
              <Table>
                <TableBody>
                  {inactiveAreas.map((area) => (
                    <TableRow key={area.id}>
                      <TableCell>
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: area.color ?? "#6B7280" }} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{area.name}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => reactivateArea.mutate(area.id)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reativar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AreaRowProps {
  area: { id: string; name: string; color: string | null; background_color: string | null; position: number; workspace: AreaWorkspace };
  count: number;
  onUpdate: (fields: Record<string, unknown>) => void;
  onDeactivate: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}

function AreaRow({ area, count, onUpdate, onDeactivate, onDelete }: AreaRowProps) {
  const [name, setName] = useState(area.name);
  const [color, setColor] = useState(area.color ?? "#6B7280");

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  onUpdate({ color: c });
                }}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: color === c ? "hsl(var(--foreground))" : "transparent" }}
              />
            ))}
          </div>
          <div className="relative w-6 h-6" title="Cor de fundo da raia (Swimlane TECH)">
            <input
              type="color"
              value={area.background_color ?? "#ffffff"}
              onChange={(e) => onUpdate({ background_color: e.target.value })}
              className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer"
            />
            <div
              className="w-6 h-6 rounded border border-border flex items-center justify-center pointer-events-none"
              style={{ backgroundColor: area.background_color ?? "transparent" }}
            >
              {!area.background_color && (
                <span className="text-[8px] text-muted-foreground">BG</span>
              )}
            </div>
            {area.background_color && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUpdate({ background_color: null }); }}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-muted text-muted-foreground text-[8px] leading-none flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                title="Remover cor de fundo"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== area.name) onUpdate({ name: name.trim() }); }}
          className="h-7 text-sm border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </TableCell>
      <TableCell>
        <Select
          value={area.workspace}
          onValueChange={(v) => onUpdate({ workspace: v as AreaWorkspace })}
        >
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cx">CX</SelectItem>
            <SelectItem value="tech">TECH</SelectItem>
            <SelectItem value="both">Ambos</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
        {count}
      </TableCell>
      <TableCell>
        {count > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onDeactivate} className="text-xs">
                Desativar
              </Button>
            </TooltipTrigger>
            <TooltipContent>{count} ticket(s) vinculado(s)</TooltipContent>
          </Tooltip>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir área "{area.name}"?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  );
}
