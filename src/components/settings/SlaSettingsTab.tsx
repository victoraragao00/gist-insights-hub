import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, RotateCcw } from "lucide-react";
import { useSlaConfigs, useUpsertSlaConfig, useResetSlaConfig } from "@/hooks/useSlaConfigs";

const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const DEFAULT_HOURS: Record<string, number> = { urgent: 2, high: 4, medium: 8, low: 24 };

export function SlaSettingsTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [globalDraft, setGlobalDraft] = useState<Record<string, number>>({});
  const [clientDraft, setClientDraft] = useState<Record<string, number>>({});

  const upsertMutation = useUpsertSlaConfig();
  const resetMutation = useResetSlaConfig();

  // Global configs
  const { data: globalData = [] } = useSlaConfigs();

  // Client configs (only when a client is selected)
  const { data: clientData = [] } = useSlaConfigs(selectedClientId || undefined);

  // Clients list
  const { data: clients = [] } = useQuery({
    queryKey: ["clients_list_sla"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const globalConfigs = useMemo(
    () => globalData.filter((c) => c.client_id === null),
    [globalData]
  );

  const clientConfigs = useMemo(
    () => clientData.filter((c) => c.client_id === selectedClientId),
    [clientData, selectedClientId]
  );

  const isDirtyGlobal = Object.keys(globalDraft).length > 0;
  const isDirtyClient = Object.keys(clientDraft).length > 0;

  const handleSaveGlobal = async () => {
    for (const priority of PRIORITIES) {
      if (globalDraft[priority] !== undefined) {
        await upsertMutation.mutateAsync({
          client_id: null,
          priority,
          hours_limit: globalDraft[priority],
        });
      }
    }
    setGlobalDraft({});
  };

  const handleSaveClient = async () => {
    for (const priority of PRIORITIES) {
      if (clientDraft[priority] !== undefined) {
        await upsertMutation.mutateAsync({
          client_id: selectedClientId,
          priority,
          hours_limit: clientDraft[priority],
        });
      }
    }
    setClientDraft({});
  };

  const getGlobalHours = (priority: string) =>
    globalConfigs.find((c) => c.priority === priority)?.hours_limit ?? DEFAULT_HOURS[priority];

  return (
    <div className="space-y-6 mt-4">
      {/* Global Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">SLA Padrão Global</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplicado a todos os clientes sem configuração própria
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prioridade</TableHead>
              <TableHead>Horas limite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRIORITIES.map((priority) => {
              const current = getGlobalHours(priority);
              return (
                <TableRow key={priority}>
                  <TableCell className="font-medium">{PRIORITY_LABELS[priority]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        value={globalDraft[priority] ?? current}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val === current) {
                            setGlobalDraft((prev) => {
                              const next = { ...prev };
                              delete next[priority];
                              return next;
                            });
                          } else {
                            setGlobalDraft((prev) => ({ ...prev, [priority]: val }));
                          }
                        }}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground">horas</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Button
          size="sm"
          onClick={handleSaveGlobal}
          disabled={!isDirtyGlobal || upsertMutation.isPending}
        >
          {upsertMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
          Salvar padrões
        </Button>
      </div>

      <Separator />

      {/* Per-Client Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">SLA por Cliente</h3>

        <Select
          value={selectedClientId}
          onValueChange={(v) => {
            setSelectedClientId(v);
            setClientDraft({});
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedClientId && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Horas limite</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRIORITIES.map((priority) => {
                  const clientConfig = clientConfigs.find((c) => c.priority === priority);
                  const isCustom = !!clientConfig;
                  const currentHours = clientConfig?.hours_limit ?? getGlobalHours(priority);

                  return (
                    <TableRow key={priority}>
                      <TableCell className="font-medium">{PRIORITY_LABELS[priority]}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={168}
                            value={clientDraft[priority] ?? currentHours}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val === currentHours) {
                                setClientDraft((prev) => {
                                  const next = { ...prev };
                                  delete next[priority];
                                  return next;
                                });
                              } else {
                                setClientDraft((prev) => ({ ...prev, [priority]: val }));
                              }
                            }}
                            className="w-20 h-8"
                          />
                          <span className="text-xs text-muted-foreground">horas</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isCustom
                              ? "bg-primary/10 text-primary border-primary/20 text-xs"
                              : "text-xs"
                          }
                        >
                          {isCustom ? "Personalizado" : "Global"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isCustom && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() =>
                              resetMutation.mutate({
                                clientId: selectedClientId,
                                priority,
                              })
                            }
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Reset
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Button
              size="sm"
              onClick={handleSaveClient}
              disabled={!isDirtyClient || upsertMutation.isPending}
            >
              {upsertMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Salvar configuração do cliente
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
