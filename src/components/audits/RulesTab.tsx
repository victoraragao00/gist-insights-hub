import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditRules, type AuditRule } from "@/hooks/useAuditRules";
import { RuleFormDialog } from "./RuleFormDialog";

const METRIC_CONFIG: Record<string, string> = {
  score_prioridade: "Score de prioridade",
  tom_critico_pct: "% Tom crítico",
  tom_alerta_pct: "% Tom alerta",
  volume_periodo: "Volume no período",
  tone_critico_count: "Msgs críticas (contagem)",
  tone_alerta_count: "Msgs alerta (contagem)",
  tone_atencao_count: "Msgs atenção (contagem)",
  out_of_scope_pct: "% Fora do escopo",
  volume_daily: "Volume diário",
  after_hours_count: "Msgs fora do horário",
  response_time_avg: "Tempo médio de resposta (min)",
};

const PAGE_SIZE = 20;

interface RulesTabProps {
  isAdmin: boolean;
}

export function RulesTab({ isAdmin }: RulesTabProps) {
  const queryClient = useQueryClient();
  const [rulesPage, setRulesPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AuditRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditRule | null>(null);

  const { data: rulesData, isLoading: loadingRules } = useAuditRules({ page: rulesPage, limit: PAGE_SIZE });
  const rules = rulesData?.rules ?? [];
  const rulesTotalCount = rulesData?.totalCount ?? 0;

  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, active }: { ruleId: string; active: boolean }) => {
      const { error } = await supabase.from("audit_rules").update({ active }).eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-rules"] });
    },
    onError: () => toast.error("Erro ao atualizar regra"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("audit_rules").delete().eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra removida");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["audit-rules"] });
    },
    onError: () => toast.error("Erro ao remover regra"),
  });

  function openCreateDialog() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function openEditDialog(rule: AuditRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" /> Nova Regra
        </Button>
      )}
      {loadingRules ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-32 animate-shimmer" />
              <Skeleton className="h-5 w-24 animate-shimmer" />
              <Skeleton className="h-5 w-16 animate-shimmer" />
              <Skeleton className="h-5 flex-1 animate-shimmer" />
              <Skeleton className="h-5 w-20 animate-shimmer" />
              <Skeleton className="h-5 w-24 animate-shimmer" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">Nenhuma regra de auditoria cadastrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Ativo</TableHead>
                {isAdmin && <TableHead className="w-20">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.client_name ?? "Todos"}</TableCell>
                  <TableCell>{METRIC_CONFIG[rule.metric] ?? rule.metric}</TableCell>
                  <TableCell>{rule.operator}</TableCell>
                  <TableCell>{rule.threshold}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        checked={rule.active ?? false}
                        onCheckedChange={(checked) => toggleMutation.mutate({ ruleId: rule.id, active: checked })}
                      />
                    ) : (
                      <span className={rule.active ? "text-emerald-600" : "text-slate-400"}>
                        {rule.active ? "Sim" : "Não"}
                      </span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(rule)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rulesTotalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {rulesPage * PAGE_SIZE + 1}–{Math.min((rulesPage + 1) * PAGE_SIZE, rulesTotalCount)} de{" "}
                {rulesTotalCount}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setRulesPage((p) => p - 1)} disabled={rulesPage === 0}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRulesPage((p) => p + 1)} disabled={(rulesPage + 1) * PAGE_SIZE >= rulesTotalCount}>
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingRule={editingRule}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra &quot;{deleteTarget?.name}&quot; será removida permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
