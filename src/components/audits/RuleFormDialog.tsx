import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { AuditRule } from "@/hooks/useAuditRules";

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

const OPERATOR_OPTIONS = [
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: "==", label: "==" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "both", label: "Ambos" },
];

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: AuditRule | null;
}

export function RuleFormDialog({ open, onOpenChange, editingRule }: RuleFormDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formClientId, setFormClientId] = useState<string | null>(null);
  const [formMetric, setFormMetric] = useState("");
  const [formOperator, setFormOperator] = useState(">=");
  const [formThreshold, setFormThreshold] = useState(0);
  const [formWindowHours, setFormWindowHours] = useState(24);
  const [formChannel, setFormChannel] = useState<"email" | "whatsapp" | "both">("email");
  const [formRecipients, setFormRecipients] = useState<Array<{ type: string; value: string }>>([]);
  const [formCooldownHours, setFormCooldownHours] = useState(24);

  const { data: clients = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["clients_options_rules", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .in("status", ["ativo", "trial"])
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  useEffect(() => {
    if (open) {
      if (editingRule) {
        setFormName(editingRule.name);
        setFormDescription(editingRule.description ?? "");
        setFormClientId(editingRule.client_id);
        setFormMetric(editingRule.metric);
        setFormOperator(editingRule.operator);
        setFormThreshold(editingRule.threshold);
        setFormWindowHours(editingRule.window_hours ?? 24);
        setFormChannel(editingRule.alert_channel ?? "email");
        setFormRecipients(
          Array.isArray(editingRule.alert_recipients)
            ? (editingRule.alert_recipients as unknown as Array<{ type: string; value: string }>)
            : []
        );
        setFormCooldownHours(editingRule.cooldown_hours ?? 24);
      } else {
        setFormName("");
        setFormDescription("");
        setFormClientId(null);
        setFormMetric("");
        setFormOperator(">=");
        setFormThreshold(0);
        setFormWindowHours(24);
        setFormChannel("email");
        setFormRecipients([]);
        setFormCooldownHours(24);
      }
    }
  }, [open, editingRule]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formName,
        description: formDescription || null,
        client_id: formClientId,
        metric: formMetric,
        operator: formOperator,
        threshold: formThreshold,
        window_hours: formWindowHours,
        alert_channel: formChannel,
        alert_recipients: formRecipients,
        cooldown_hours: formCooldownHours,
      };
      if (editingRule) {
        const { error } = await supabase.from("audit_rules").update(payload).eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("audit_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRule ? "Regra atualizada" : "Regra criada");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["audit-rules"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Erro";
      if (msg.includes("audit_rules_client_metric_unique")) {
        toast.error("Já existe uma regra para esta métrica neste cliente");
      } else {
        toast.error("Erro: " + msg);
      }
    },
  });

  function handleSave() {
    if (!formName || !formMetric) {
      toast.error("Nome e métrica são obrigatórios");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Nome *</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Descrição</Label>
            <Textarea rows={2} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Cliente</Label>
            <Select value={formClientId ?? "__all__"} onValueChange={(v) => setFormClientId(v === "__all__" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Métrica *</Label>
            <Select value={formMetric} onValueChange={setFormMetric}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_CONFIG).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Operador *</Label>
              <Select value={formOperator} onValueChange={setFormOperator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Threshold *</Label>
              <Input type="number" value={formThreshold} onChange={(e) => setFormThreshold(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Janela (horas)</Label>
              <Input type="number" value={formWindowHours} onChange={(e) => setFormWindowHours(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Cooldown (horas)</Label>
              <Input type="number" value={formCooldownHours} onChange={(e) => setFormCooldownHours(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">Canal de alerta</Label>
            <Select value={formChannel} onValueChange={(v) => setFormChannel(v as "email" | "whatsapp" | "both")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Destinatários</Label>
            {formRecipients.map((r, i) => (
              <div key={`recipient-${r.value || i}`} className="flex gap-2 items-center">
                <Select
                  value={r.type}
                  onValueChange={(v) => {
                    const updated = [...formRecipients];
                    updated[i] = { ...updated[i], type: v };
                    setFormRecipients(updated);
                  }}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  placeholder={r.type === "email" ? "email@exemplo.com" : "+5511999999999"}
                  value={r.value}
                  onChange={(e) => {
                    const updated = [...formRecipients];
                    updated[i] = { ...updated[i], value: e.target.value };
                    setFormRecipients(updated);
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => setFormRecipients(formRecipients.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setFormRecipients([...formRecipients, { type: "email", value: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar destinatário
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : editingRule ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
