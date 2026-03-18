import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAllDemandAssignees, useManageAssignees } from "@/hooks/useDemandAssignees";
import { useQuery } from "@tanstack/react-query";

export function AssigneeSettingsTab() {
  const { data: allAssignees = [] } = useAllDemandAssignees();
  const { addAssignee, updateAssignee, deactivateAssignee, reactivateAssignee, deleteAssignee } = useManageAssignees();

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");

  const active = useMemo(() => allAssignees.filter((a) => a.active), [allAssignees]);
  const inactive = useMemo(() => allAssignees.filter((a) => !a.active), [allAssignees]);

  // Count demands per assignee
  const { data: assigneeCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["assignee_demand_counts"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select("assignee_id")
        .not("assignee_id", "is", null)
        .limit(1000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.assignee_id) counts[row.assignee_id] = (counts[row.assignee_id] || 0) + 1;
      }
      return counts;
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    addAssignee.mutate({
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      role: newRole.trim() || undefined,
    });
    setNewName("");
    setNewEmail("");
    setNewRole("");
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Responsáveis</CardTitle>
          <CardDescription>Gerencie os responsáveis que podem ser atribuídos a demandas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome *"
              className="flex-1 min-w-32 h-9"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="w-44 h-9"
              type="email"
            />
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Role (KA, Tech...)"
              className="w-36 h-9"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addAssignee.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Active */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((a) => {
                const count = assigneeCounts[a.id] ?? 0;
                return (
                  <AssigneeRow
                    key={a.id}
                    assignee={a}
                    count={count}
                    onUpdate={(fields) => updateAssignee.mutate({ id: a.id, fields })}
                    onDeactivate={() => deactivateAssignee.mutate(a.id)}
                    onDelete={() => deleteAssignee.mutate(a.id)}
                  />
                );
              })}
              {active.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhum responsável ativo
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Inactive */}
          {inactive.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground pt-2">Inativos</p>
              <Table>
                <TableBody>
                  {inactive.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{a.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{a.role ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => reactivateAssignee.mutate(a.id)}>
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

interface AssigneeRowProps {
  assignee: { id: string; name: string; email: string | null; role: string | null };
  count: number;
  onUpdate: (fields: Record<string, unknown>) => void;
  onDeactivate: () => void;
  onDelete: () => void;
}

function AssigneeRow({ assignee, count, onUpdate, onDeactivate, onDelete }: AssigneeRowProps) {
  const [name, setName] = useState(assignee.name);
  const [email, setEmail] = useState(assignee.email ?? "");
  const [role, setRole] = useState(assignee.role ?? "");

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== assignee.name) onUpdate({ name: name.trim() }); }}
          className="h-7 text-sm border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </TableCell>
      <TableCell>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => { if (email !== (assignee.email ?? "")) onUpdate({ email: email || null }); }}
          className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0"
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onBlur={() => { if (role !== (assignee.role ?? "")) onUpdate({ role: role || null }); }}
          className="h-7 text-xs border-0 p-0 shadow-none focus-visible:ring-0"
          placeholder="—"
        />
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
                <AlertDialogTitle>Excluir "{assignee.name}"?</AlertDialogTitle>
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
