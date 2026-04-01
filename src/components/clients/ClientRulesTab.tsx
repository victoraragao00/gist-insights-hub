import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useClientRules, useCreateClientRule, useUpdateClientRule, useDeleteClientRule } from "@/hooks/useClientRules";
import { useAuditRules } from "@/hooks/useAuditRules";

interface Props {
  clientId: string;
}

const OPERATOR_LABELS: Record<string, string> = {
  ">": ">",
  "<": "<",
  ">=": "≥",
  "<=": "≤",
  "==": "=",
};

export function ClientRulesTab({ clientId }: Props) {
  const { data: rules = [], isLoading } = useClientRules(clientId);
  const { data: auditData } = useAuditRules({ limit: 100 });
  const createRule = useCreateClientRule(clientId);
  const updateRule = useUpdateClientRule(clientId);
  const deleteRule = useDeleteClientRule(clientId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDescription, setNewDescription] = useState("");

  // Filter audit_rules: global (no client_id) + specific to this client
  const globalRules = (auditData?.rules ?? []).filter(
    (r) => r.active && (r.client_id === null || r.client_id === clientId)
  );

  const handleCreate = () => {
    if (!newDescription.trim()) return;
    createRule.mutate(newDescription.trim(), {
      onSuccess: () => {
        setDialogOpen(false);
        setNewDescription("");
      },
    });
  };

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando regras...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Regras Globais */}
      <Card className="border border-border rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Regras Globais</CardTitle>
            <Badge variant="secondary" className="text-xs">Auditoria automática</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {globalRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra de auditoria ativa.</p>
          ) : (
            globalRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.metric} {OPERATOR_LABELS[rule.operator] ?? rule.operator} {rule.threshold}
                      {rule.window_hours ? ` (${rule.window_hours}h)` : ""}
                      {rule.description ? ` — ${rule.description}` : ""}
                    </p>
                  </div>
                </div>
                {rule.client_id === clientId && (
                  <Badge variant="outline" className="text-xs">Específica</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Section 2: Regras deste Cliente */}
      <Card className="border border-border rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Regras deste Cliente</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra específica para este cliente.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <Switch
                  checked={rule.active}
                  onCheckedChange={(checked) => updateRule.mutate({ id: rule.id, active: checked })}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <textarea
                    className="text-sm w-full bg-transparent border-none outline-none resize-none focus:ring-1 focus:ring-ring rounded px-1 -ml-1"
                    defaultValue={rule.description}
                    rows={2}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== rule.description) {
                        updateRule.mutate({ id: rule.id, description: val });
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground ml-1">
                    {new Date(rule.created_at).toLocaleDateString("pt-BR")}
                    {!rule.active && " · Inativa"}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                      <AlertDialogDescription>Esta regra será removida permanentemente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteRule.mutate(rule.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialog: Nova Regra */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova regra do cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              placeholder="Descreva a regra de negócio..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending || !newDescription.trim()}>
              {createRule.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
