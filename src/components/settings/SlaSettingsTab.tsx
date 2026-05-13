import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, RotateCcw } from "lucide-react";
import { useSlaConfigs, useUpsertSlaConfig, useResetSlaConfig } from "@/hooks/useSlaConfigs";
import { useDemandTypes } from "@/hooks/useDemands";

const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
const DEFAULT_HOURS: Record<string, number> = { urgent: 2, high: 4, medium: 8, low: 24 };
const ALL_TYPES = "__all__";

interface RowDraft {
  hours?: number;
  enabled?: boolean;
}

export function SlaSettingsTab() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>(ALL_TYPES); // ALL_TYPES = demand_type_id null
  const [globalDraft, setGlobalDraft] = useState<Record<string, RowDraft>>({});
  const [clientDraft, setClientDraft] = useState<Record<string, RowDraft>>({});

  const upsertMutation = useUpsertSlaConfig();
  const resetMutation = useResetSlaConfig();
  const { data: demandTypes = [] } = useDemandTypes();

  const typeIdParam: string | null = selectedTypeId === ALL_TYPES ? null : selectedTypeId;

  // Globals (client_id NULL) for current type filter (or all-types)
  const { data: globalData = [] } = useSlaConfigs(undefined, typeIdParam);
  // Client-specific configs
  const { data: clientData = [] } = useSlaConfigs(selectedClientId || undefined, typeIdParam);

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
      const draft = globalDraft[priority];
      if (!draft) continue;
      const current = globalConfigs.find((c) => c.priority === priority);
      await upsertMutation.mutateAsync({
        client_id: null,
        demand_type_id: typeIdParam,
        priority,
        hours_limit: draft.hours ?? current?.hours_limit ?? DEFAULT_HOURS[priority],
        enabled: draft.enabled ?? current?.enabled ?? true,
      });
    }
    setGlobalDraft({});
  };

  const handleSaveClient = async () => {
    for (const priority of PRIORITIES) {
      const draft = clientDraft[priority];
      if (!draft) continue;
      const current = clientConfigs.find((c) => c.priority === priority);
      const fallback = globalConfigs.find((c) => c.priority === priority);
      await upsertMutation.mutateAsync({
        client_id: selectedClientId,
        demand_type_id: typeIdParam,
        priority,
        hours_limit:
          draft.hours ??
          current?.hours_limit ??
          fallback?.hours_limit ??
          DEFAULT_HOURS[priority],
        enabled: draft.enabled ?? current?.enabled ?? fallback?.enabled ?? true,
      });
    }
    setClientDraft({});
  };

  const getGlobalRow = (priority: string) => {
    const cfg = globalConfigs.find((c) => c.priority === priority);
    return {
      hours: cfg?.hours_limit ?? DEFAULT_HOURS[priority],
      enabled: cfg?.enabled ?? true,
    };
  };

  const typeLabel =
    selectedTypeId === ALL_TYPES
      ? "Todos os tipos"
      : demandTypes.find((t) => t.id === selectedTypeId)?.name ?? "";

  return (
    <div className="space-y-6 mt-4">
      {/* Type selector — applies to both sections */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Tipo de demanda</h3>
        <p className="text-xs text-muted-foreground">
          Configure SLAs específicos por tipo. "Todos os tipos" é o padrão usado quando não houver regra para o tipo da demanda.
        </p>
        <Select value={selectedTypeId} onValueChange={(v) => { setSelectedTypeId(v); setGlobalDraft({}); setClientDraft({}); }}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Todos os tipos (padrão)</SelectItem>
            {demandTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Global Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium">SLA Global · {typeLabel}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplicado a todos os clientes sem configuração própria. Desligue para excluir o tipo do painel de SLA.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prioridade</TableHead>
              <TableHead>Horas limite</TableHead>
              <TableHead>SLA ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRIORITIES.map((priority) => {
              const current = getGlobalRow(priority);
              const draft = globalDraft[priority] ?? {};
              const hours = draft.hours ?? current.hours;
              const enabled = draft.enabled ?? current.enabled;
              return (
                <TableRow key={priority}>
                  <TableCell className="font-medium">{PRIORITY_LABELS[priority]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={168}
                        disabled={!enabled}
                        value={hours}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setGlobalDraft((prev) => ({
                            ...prev,
                            [priority]: { ...prev[priority], hours: val },
                          }));
                        }}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground">horas</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => {
                          setGlobalDraft((prev) => ({
                            ...prev,
                            [priority]: { ...prev[priority], enabled: v },
                          }));
                        }}
                      />
                      {!enabled && (
                        <Badge variant="outline" className="text-xs">Sem SLA</Badge>
                      )}
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
        <h3 className="text-sm font-medium">SLA por Cliente · {typeLabel}</h3>

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
                  <TableHead>SLA ativo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRIORITIES.map((priority) => {
                  const clientConfig = clientConfigs.find((c) => c.priority === priority);
                  const isCustom = !!clientConfig;
                  const fallback = getGlobalRow(priority);
                  const currentHours = clientConfig?.hours_limit ?? fallback.hours;
                  const currentEnabled = clientConfig?.enabled ?? fallback.enabled;
                  const draft = clientDraft[priority] ?? {};
                  const hours = draft.hours ?? currentHours;
                  const enabled = draft.enabled ?? currentEnabled;

                  return (
                    <TableRow key={priority}>
                      <TableCell className="font-medium">{PRIORITY_LABELS[priority]}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={168}
                            disabled={!enabled}
                            value={hours}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setClientDraft((prev) => ({
                                ...prev,
                                [priority]: { ...prev[priority], hours: val },
                              }));
                            }}
                            className="w-20 h-8"
                          />
                          <span className="text-xs text-muted-foreground">horas</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={enabled}
                            onCheckedChange={(v) => {
                              setClientDraft((prev) => ({
                                ...prev,
                                [priority]: { ...prev[priority], enabled: v },
                              }));
                            }}
                          />
                          {!enabled && (
                            <Badge variant="outline" className="text-xs">Sem SLA</Badge>
                          )}
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
                                demandTypeId: typeIdParam,
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
