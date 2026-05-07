import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type PriorityCfg = Tables<"demand_priority_config">;

export function DemandPrioritiesSettingsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["demand_priority_config"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_priority_config")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as PriorityCfg[];
    },
  });

  const update = useMutation({
    mutationFn: async (input: Partial<PriorityCfg> & { priority: PriorityCfg["priority"] }) => {
      const { error } = await supabase
        .from("demand_priority_config")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("priority", input.priority);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demand_priority_config"] });
      toast.success("Prioridade atualizada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Prioridades de demanda</CardTitle>
          <CardDescription>
            Configure rótulo, cor e o SLA padrão (em horas) de cada nível de prioridade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Rótulo</TableHead>
                  <TableHead className="w-24">Cor</TableHead>
                  <TableHead className="w-32">SLA padrão (h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.priority}>
                    <TableCell><span className="font-mono text-xs">{r.priority}</span></TableCell>
                    <TableCell>
                      <Input
                        defaultValue={r.label}
                        className="h-8"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== r.label) update.mutate({ priority: r.priority, label: v });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="color"
                        defaultValue={r.color}
                        className="w-14 h-8 p-1"
                        onChange={(e) => update.mutate({ priority: r.priority, color: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        defaultValue={r.sla_default_hours}
                        className="h-8 w-24"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v > 0 && v !== r.sla_default_hours) update.mutate({ priority: r.priority, sla_default_hours: v });
                        }}
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
