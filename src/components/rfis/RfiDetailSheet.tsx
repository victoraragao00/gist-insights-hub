import { useState, useCallback, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import { useRfiStatuses, useUpdateRfi } from "@/hooks/useRfis";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RfiDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfi: {
    id: string;
    demand_id: string;
    rfi_number: string;
    subject: string | null;
    description: string | null;
    link: string | null;
    status_id: string | null;
    assignee_id: string | null;
    due_date: string | null;
    budget_value: number | null;
    rfi_statuses?: { name: string; color: string | null } | null;
    user_profiles?: { full_name: string | null; email: string | null } | null;
  };
  demandTitle?: string;
  clientName?: string;
}

export function RfiDetailSheet({ open, onOpenChange, rfi, demandTitle, clientName }: RfiDetailSheetProps) {
  const { data: statuses = [] } = useRfiStatuses();
  const updateMutation = useUpdateRfi();

  const { data: userProfiles = [] } = useQuery({
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

  const [subject, setSubject] = useState(rfi.subject ?? "");
  const [description, setDescription] = useState(rfi.description ?? "");
  const [link, setLink] = useState(rfi.link ?? "");
  const [dueDate, setDueDate] = useState(rfi.due_date ?? "");
  const [budgetValue, setBudgetValue] = useState(rfi.budget_value?.toString() ?? "");

  useEffect(() => {
    setSubject(rfi.subject ?? "");
    setDescription(rfi.description ?? "");
    setLink(rfi.link ?? "");
    setDueDate(rfi.due_date ?? "");
    setBudgetValue(rfi.budget_value?.toString() ?? "");
  }, [rfi.id, rfi.subject, rfi.description, rfi.link, rfi.due_date, rfi.budget_value]);

  const saveField = useCallback(
    (field: string, value: string | number | null) => {
      updateMutation.mutate({ id: rfi.id, demandId: rfi.demand_id, fields: { [field]: value } });
    },
    [rfi.id, rfi.demand_id, updateMutation]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">{rfi.rfi_number}</Badge>
            {rfi.rfi_statuses && (
              <Badge style={{ backgroundColor: rfi.rfi_statuses.color ?? undefined }} className="text-white text-xs">
                {rfi.rfi_statuses.name}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Referências */}
          <div className="text-xs text-muted-foreground space-y-1">
            {demandTitle && <div>Demanda: <span className="font-medium text-foreground">{demandTitle}</span></div>}
            {clientName && <div>Cliente: <span className="font-medium text-foreground">{clientName}</span></div>}
          </div>

          <Separator />

          {/* Assunto */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Assunto</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={() => { if (subject !== (rfi.subject ?? "")) saveField("subject", subject || null); }}
              className="h-8"
              placeholder="Assunto da RFI"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={rfi.status_id ?? ""}
              onValueChange={(v) => saveField("status_id", v || null)}
            >
              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      {s.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Link</Label>
            <div className="flex items-center gap-1.5">
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onBlur={() => { if (link !== (rfi.link ?? "")) saveField("link", link || null); }}
                className="h-8 flex-1"
                type="url"
                placeholder="https://..."
              />
              {link.trim() && (
                <a href={link} target="_blank" rel="noopener noreferrer" title="Abrir link">
                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select
              value={rfi.assignee_id ?? ""}
              onValueChange={(v) => saveField("assignee_id", v || null)}
            >
              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {userProfiles.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de vencimento */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data de vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => { if (dueDate !== (rfi.due_date ?? "")) saveField("due_date", dueDate || null); }}
              className="h-8"
            />
          </div>

          {/* Valor / Orçamento */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor / Orçamento (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              onBlur={() => {
                const num = budgetValue ? parseFloat(budgetValue) : null;
                if (num !== rfi.budget_value) saveField("budget_value", num);
              }}
              className="h-8"
              placeholder="0,00"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Descrição / Observações</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (description !== (rfi.description ?? "")) saveField("description", description || null); }}
              rows={4}
              placeholder="Notas sobre a RFI..."
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
