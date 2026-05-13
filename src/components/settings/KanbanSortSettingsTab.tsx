import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useKanbanSortMode, useUpdateKanbanSortMode, type KanbanSortMode } from "@/hooks/useKanbanSortMode";
import { useUserRole } from "@/hooks/useUserRole";

const OPTIONS: Array<{ value: KanbanSortMode; label: string; description: string }> = [
  {
    value: "manual",
    label: "Manual (arrastar e soltar)",
    description: "Os cards mantêm a posição definida pelos usuários no Kanban.",
  },
  {
    value: "oldest_first",
    label: "Mais antigos primeiro",
    description: "Cards mais antigos no topo. Drag & drop dentro da coluna fica desativado.",
  },
  {
    value: "newest_first",
    label: "Mais novos primeiro",
    description: "Cards recém-criados aparecem no topo da coluna.",
  },
  {
    value: "priority",
    label: "Por criticidade",
    description: "Urgente → Alta → Média → Baixa. Em empate, mais antigo primeiro.",
  },
];

export function KanbanSortSettingsTab() {
  const { isAdmin } = useUserRole();
  const { data: mode = "manual", isLoading } = useKanbanSortMode();
  const updateMutation = useUpdateKanbanSortMode();

  return (
    <div className="space-y-4 mt-4 max-w-2xl">
      <div>
        <h3 className="text-sm font-medium">Ordenação dos cards no Kanban</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Define como as demandas são ordenadas dentro de cada coluna do board.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <RadioGroup
          value={mode}
          onValueChange={(v) => isAdmin && updateMutation.mutate(v as KanbanSortMode)}
          disabled={!isAdmin || updateMutation.isPending}
          className="space-y-3"
        >
          {OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
            >
              <RadioGroupItem value={opt.value} id={`sort-${opt.value}`} className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor={`sort-${opt.value}`} className="cursor-pointer">
                  {opt.label}
                </Label>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      )}

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Apenas administradores podem alterar a ordenação.
        </p>
      )}
    </div>
  );
}
