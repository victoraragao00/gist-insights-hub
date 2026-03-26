import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAgendaFieldConfig, type AgendaFieldConfig, type FieldVisibility } from "@/hooks/useAgendaFieldConfig";

const FIELD_LABELS: Record<keyof AgendaFieldConfig, string> = {
  title: "Título",
  meeting_date: "Data da Reunião",
  client_id: "Cliente",
  objective: "Objetivo",
  context_notes: "Notas de Contexto",
  satisfaction_score: "Satisfação",
  next_steps: "Próximos Passos",
  transcription: "Transcrição",
  location: "Local",
};

const VISIBILITY_OPTIONS: { value: FieldVisibility; label: string }[] = [
  { value: "required", label: "Obrigatório" },
  { value: "optional", label: "Opcional" },
  { value: "hidden", label: "Oculto" },
];

export function AgendaSettingsTab() {
  const { data: fieldConfig, isLoading } = useAgendaFieldConfig();
  const [draft, setDraft] = useState<AgendaFieldConfig | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (fieldConfig && !draft) {
      setDraft({ ...fieldConfig });
    }
  }, [fieldConfig, draft]);

  const saveMutation = useMutation({
    mutationFn: async (config: AgendaFieldConfig) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: config as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
        .eq("key", "agenda_required_fields");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda_field_config"] });
      toast.success("Configuração de pautas salva");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDirty = fieldConfig && JSON.stringify(draft) !== JSON.stringify(fieldConfig);

  const fields = Object.keys(FIELD_LABELS) as (keyof AgendaFieldConfig)[];

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Campos das Pautas de Reunião</CardTitle>
          <CardDescription>
            Defina quais campos são obrigatórios, opcionais ou ocultos no formulário de pautas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Visibilidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field}>
                  <TableCell className="font-medium text-sm">{FIELD_LABELS[field]}</TableCell>
                  <TableCell>
                    <RadioGroup
                      value={draft[field]}
                      onValueChange={(v) => setDraft({ ...draft, [field]: v as FieldVisibility })}
                      className="flex gap-4"
                    >
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-1.5">
                          <RadioGroupItem value={opt.value} id={`${field}-${opt.value}`} />
                          <Label htmlFor={`${field}-${opt.value}`} className="text-sm cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end">
            <Button
              disabled={!isDirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar Configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
