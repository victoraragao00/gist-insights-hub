import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Unlock, Trash2, X, Plus, FileText, Loader2, ChevronRight, TimerOff, Timer } from "lucide-react";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useTicketColumns, useDemandTypes, useUpdateDemand, useMoveDemand, useDeleteDemand,
  useChangeDemandWorkspace, usePauseSla, useResumeSla,
  useDemandActivities, type DemandRow,
} from "@/hooks/useDemands";
import { useDemandAreas } from "@/hooks/useDemandAreas";
import { useDemandWatchers, useToggleWatcher } from "@/hooks/useDemandWatchers";
import {
  useDemandCollaborators, useAddCollaborator, useRemoveCollaborator,
} from "@/hooks/useDemandCollaborators";
import { useBlockerTypes } from "@/hooks/useBlockerTypes";
import { createDemandNotification } from "@/hooks/useDemandNotifications";
import { useRfiByDemand, useCreateRfi, useRfiStatuses, useDeleteRfi } from "@/hooks/useRfis";
import { RfiDetailSheet } from "@/components/rfis/RfiDetailSheet";
import { DemandTimeTrackingSection } from "../DemandTimeTrackingSection";
import { useDemandTaskStats } from "@/hooks/useDemandTasks";
import {
  useDemandTotalHours,
  useAddManualEntry,
} from "@/hooks/useDemandTimeEntries";
import { formatHours } from "@/lib/formatHours";
import { AssigneeDisplay } from "./AssigneeDisplay";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import {
  useLinkDemandToProject,
  useUnlinkDemandFromProject,
} from "@/hooks/useProjects";
import { DemandDependenciesSection } from "./DemandDependenciesSection";
import { DemandDatesSection } from "./DemandDatesSection";
import { useDemandRelationships } from "@/hooks/useDemandRelationships";


interface DemandSidebarProps {
  demand: DemandRow;
  onActivityTabSelect: () => void;
  onClose: () => void;
}

export function DemandSidebar({ demand, onActivityTabSelect, onClose }: DemandSidebarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: areas = [] } = useDemandAreas();
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
  const { data: watchers = [] } = useDemandWatchers(demand.id);
  const toggleWatcherMutation = useToggleWatcher(demand.id);
  const { data: collaborators = [] } = useDemandCollaborators(demand.id);
  const addCollaborator = useAddCollaborator();
  const removeCollaborator = useRemoveCollaborator();
  const { data: blockerTypes = [] } = useBlockerTypes();
  const { data: rfiData } = useRfiByDemand(demand.id);
  const createRfiMutation = useCreateRfi();
  const deleteRfiMutation = useDeleteRfi();
  const { data: rfiStatuses = [] } = useRfiStatuses();
  const { data: activities = [] } = useDemandActivities(demand.id);

  const updateMutation = useUpdateDemand();
  const moveMutation = useMoveDemand();
  const deleteMutation = useDeleteDemand();
  const changeWorkspaceMutation = useChangeDemandWorkspace();
  const pauseSlaMutation = usePauseSla();
  const resumeSlaMutation = useResumeSla();

  const linkDemand = useLinkDemandToProject();
  const unlinkDemand = useUnlinkDemandFromProject();
  const [moveBoardOpen, setMoveBoardOpen] = useState(false);
  const [pauseSlaOpen, setPauseSlaOpen] = useState(false);
  const [pauseSlaReason, setPauseSlaReason] = useState("");
  

  const [rfiSheetOpen, setRfiSheetOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedBlockerType, setSelectedBlockerType] = useState<string>("");
  const [blockerReason, setBlockerReason] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);
  const [collabPopoverOpen, setCollabPopoverOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const isWatching = watchers.some((w) => w.user_id === user?.id);

  const handleColumnChange = (newColumnId: string) => {
    const targetCol = columns.find((c) => c.id === newColumnId);
    if (!targetCol) return;
    moveMutation.mutate({
      demandId: demand.id,
      targetColumnId: newColumnId,
      targetPosition: 0,
      sourceColumnName: demand.ticket_columns?.name ?? "",
      targetColumnName: targetCol.name,
      currentStartedAt: demand.started_at,
      targetTriggersStartedAt: targetCol.triggers_started_at ?? false,
      targetTriggersFinishedAt: targetCol.triggers_finished_at ?? false,
    });
  };

  const handleBlock = async () => {
    if (!selectedBlockerType) return;
    setBlockLoading(true);
    try {
      const { error } = await supabase
        .from("demands")
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocker_type_id: selectedBlockerType,
          blocker_reason: blockerReason.trim() || null,
        })
        .eq("id", demand.id);
      if (error) throw error;
      const btName = blockerTypes.find((b) => b.id === selectedBlockerType)?.name ?? "Bloqueado";
      const { error: actErr } = await supabase.from("demand_activities").insert({
        demand_id: demand.id,
        event_type: "blocked",
        description: `Bloqueado: ${btName}${blockerReason.trim() ? ` — ${blockerReason.trim()}` : ""}`,
        created_by: user?.id,
      });
      if (actErr) throw actErr;
      await createDemandNotification({
        demandId: demand.id,
        type: "blocked",
        message: `Demanda bloqueada: ${btName}${blockerReason.trim() ? ` — ${blockerReason.trim()}` : ""}`,
        actorId: user?.id ?? null,
      });
      toast.success("Demanda marcada como bloqueada");
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["demand"] });
      queryClient.invalidateQueries({ queryKey: ["client_demands"] });
      setBlockDialogOpen(false);
      setSelectedBlockerType("");
      setBlockerReason("");
    } catch (err) {
      toast.error("Erro ao bloquear: " + (err instanceof Error ? err.message : "Erro"));
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    try {
      const { error } = await supabase
        .from("demands")
        .update({ is_blocked: false, blocked_at: null, blocker_reason: null, blocker_type_id: null, blocked_by: null })
        .eq("id", demand.id);
      if (error) throw error;
      const { error: actErr } = await supabase.from("demand_activities").insert({
        demand_id: demand.id,
        event_type: "unblocked",
        description: "Desbloqueado",
        created_by: user?.id,
      });
      if (actErr) throw actErr;
      await createDemandNotification({
        demandId: demand.id,
        type: "unblocked",
        message: "Demanda desbloqueada",
        actorId: user?.id ?? null,
      });
      toast.success("Demanda desbloqueada");
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["demand"] });
      queryClient.invalidateQueries({ queryKey: ["client_demands"] });
    } catch (err) {
      toast.error("Erro ao desbloquear: " + (err instanceof Error ? err.message : "Erro"));
    }
  };

  const handleCancel = async () => {
    const reason = cancelReason === "outro" ? cancelOther.trim() : cancelReason;
    if (!reason) return;
    setCancelLoading(true);
    try {
      const cancelCol = columns.find((c) => c.name.toLowerCase().includes("cancelad"));
      const { error } = await supabase
        .from("demands")
        .update({ cancellation_reason: reason, ...(cancelCol ? { column_id: cancelCol.id } : {}) })
        .eq("id", demand.id);
      if (error) throw error;
      const { error: actErr } = await supabase.from("demand_activities").insert({
        demand_id: demand.id,
        event_type: "cancelled",
        description: `Cancelado: ${reason}`,
        created_by: user?.id,
      });
      if (actErr) throw actErr;
      toast.success("Demanda cancelada");
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["client_demands"] });
      setCancelDialogOpen(false);
      onClose();
    } catch (err) {
      toast.error("Erro ao cancelar: " + (err instanceof Error ? err.message : "Erro"));
    } finally {
      setCancelLoading(false);
    }
  };

  const recentActivities = activities.slice(0, 3);
  const assigneeProfile = userProfiles.find((u) => u.id === demand.assignee_id);

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <aside className="w-full min-w-0 space-y-4">
      {/* Details */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Detalhes
        </p>

        <div className="space-y-0">
          <div className="flex items-center justify-between py-2 text-sm border-b border-border/50">
            <span className="text-muted-foreground text-xs">Projeto</span>
            <ProjectSelect
              value={demand.project_id}
              onSelect={(projectId) =>
                linkDemand.mutate({ demandId: demand.id, projectId })
              }
              onClear={() =>
                unlinkDemand.mutate({
                  demandId: demand.id,
                  projectId: demand.project_id,
                })
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Coluna</Label>
            <Select value={demand.column_id} onValueChange={handleColumnChange}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prioridade</Label>
            <Select
              value={demand.priority}
              onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { priority: v }, fieldLabel: "Prioridade" })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select
              value={demand.demand_type_id}
              onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { demand_type_id: v }, fieldLabel: "Tipo" })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Área</Label>
            <Select
              value={demand.area_id ?? ""}
              onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { area_id: v || null }, fieldLabel: "Área" })}
            >
              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      {a.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />}
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const creatorProfile = userProfiles.find((u) => u.id === demand.created_by);
            const creatorLabel = creatorProfile?.full_name || creatorProfile?.email || "—";
            return (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Criador</Label>
                <div className="flex items-center gap-1.5 h-8 px-2 rounded-md border border-border bg-muted/30 text-sm">
                  {creatorProfile ? (
                    <>
                      <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex items-center justify-center shrink-0">
                        {initialsOf(creatorLabel)}
                      </span>
                      <span className="truncate">{creatorLabel}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Select
              value={demand.assignee_id ?? ""}
              onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { assignee_id: v || null }, fieldLabel: "Responsável" })}
            >
              <SelectTrigger className="h-8">
                {assigneeProfile ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-[10px] font-medium flex items-center justify-center shrink-0">
                      {initialsOf(assigneeProfile.full_name || assigneeProfile.email || "?")}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {assigneeProfile.full_name || assigneeProfile.email}
                    </span>
                  </div>
                ) : (
                  <SelectValue placeholder="—" />
                )}
              </SelectTrigger>
              <SelectContent>
                {userProfiles.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Co-responsáveis */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Co-responsáveis</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {collaborators.map((c) => {
                const label = c.full_name || c.email || "—";
                return (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className="text-[11px] gap-1 pl-1 pr-1 py-0 h-6"
                  >
                    <span className="w-4 h-4 rounded-full bg-muted text-foreground/70 text-[9px] font-semibold flex items-center justify-center">
                      {initialsOf(label)}
                    </span>
                    <span className="max-w-[120px] truncate">{label}</span>
                    <button
                      type="button"
                      onClick={() =>
                        removeCollaborator.mutate({ demandId: demand.id, userId: c.user_id })
                      }
                      className="text-muted-foreground hover:text-destructive ml-0.5"
                      aria-label={`Remover ${label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              <Popover open={collabPopoverOpen} onOpenChange={setCollabPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar pessoa..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma pessoa encontrada</CommandEmpty>
                      <CommandGroup>
                        {userProfiles
                          .filter(
                            (u) =>
                              u.id !== demand.assignee_id &&
                              !collaborators.some((c) => c.user_id === u.id),
                          )
                          .map((u) => (
                            <CommandItem
                              key={u.id}
                              value={`${u.full_name ?? ""} ${u.email ?? ""}`}
                              onSelect={() => {
                                addCollaborator.mutate({
                                  demandId: demand.id,
                                  userId: u.id,
                                });
                                setCollabPopoverOpen(false);
                              }}
                            >
                              {u.full_name ?? u.email}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Workspace / Board */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Board</Label>
            <div className="flex items-center justify-between gap-2 h-8 px-2 rounded-md border border-border bg-muted/30 text-sm">
              <span className="font-medium">
                {demand.workspace === "tech" ? "TECH" : "CX Hub"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:text-primary"
                onClick={() => setMoveBoardOpen(true)}
                disabled={changeWorkspaceMutation.isPending}
              >
                Mover para {demand.workspace === "tech" ? "CX Hub" : "TECH"}
              </Button>
            </div>
          </div>

        </div>
      </section>

      {/* Move board confirmation */}
      <AlertDialog open={moveBoardOpen} onOpenChange={setMoveBoardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mover demanda para o board {demand.workspace === "tech" ? "CX Hub" : "TECH"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A demanda muda apenas de board. Coluna, área, responsável e demais
              informações são preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = demand.workspace === "tech" ? "cx" : "tech";
                changeWorkspaceMutation.mutate({
                  demandId: demand.id,
                  currentWorkspace: (demand.workspace === "tech" ? "tech" : "cx"),
                  targetWorkspace: target,
                });
                setMoveBoardOpen(false);
              }}
            >
              Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* RFI */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          RFI
        </p>
        {rfiData ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setRfiSheetOpen(true)}
              className="flex-1 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono font-semibold text-sm truncate">{rfiData.rfi_number}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={deleteRfiMutation.isPending}
                  aria-label="Excluir RFI"
                >
                  {deleteRfiMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este RFI?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteRfiMutation.mutate({ id: rfiData.id, demandId: demand.id })}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button
            variant="outline" size="sm" className="w-full h-8 text-xs"
            onClick={() => createRfiMutation.mutate({ demand_id: demand.id, status_id: rfiStatuses[0]?.id })}
            disabled={createRfiMutation.isPending}
          >
            {createRfiMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Criar RFI
          </Button>
        )}
      </section>

      {/* Time tracking */}
      <section className="rounded-lg border border-border bg-card p-4">
        <TimeTrackingWidget demandId={demand.id} />
      </section>

      {/* Bloqueio */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bloqueio
        </p>
        {demand.is_blocked ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-destructive/30 text-destructive text-xs">
                <Lock className="h-3 w-3 mr-1" /> Bloqueado
              </Badge>
              {demand.blocked_at && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(demand.blocked_at), { addSuffix: true, locale: ptBR })}
                </span>
              )}
            </div>
            {demand.blocked_by && <p className="text-xs text-muted-foreground">Por: {demand.blocked_by}</p>}
            {demand.blocker_reason && <p className="text-xs text-foreground">{demand.blocker_reason}</p>}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                  <Unlock className="h-3 w-3 mr-1" /> Desbloquear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desbloquear demanda?</AlertDialogTitle>
                  <AlertDialogDescription>O bloqueio será removido e os campos limpos.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnblock}>Desbloquear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={() => setBlockDialogOpen(true)}>
            <Lock className="h-3 w-3 mr-1" /> Marcar como bloqueado
          </Button>
        )}
      </section>

      {/* SLA */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          SLA
        </p>
        {demand.sla_paused_at ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                <TimerOff className="h-3 w-3 mr-1" /> SLA encerrado
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(demand.sla_paused_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            {demand.sla_paused_reason && (
              <p className="text-xs text-foreground">{demand.sla_paused_reason}</p>
            )}
            <Button
              variant="outline" size="sm" className="h-7 text-xs w-full"
              onClick={() => resumeSlaMutation.mutate(demand.id)}
              disabled={resumeSlaMutation.isPending}
            >
              <Timer className="h-3 w-3 mr-1" /> Reativar SLA
            </Button>
          </div>
        ) : (
          <Button
            variant="outline" size="sm" className="h-8 text-xs w-full"
            onClick={() => { setPauseSlaReason(""); setPauseSlaOpen(true); }}
          >
            <TimerOff className="h-3 w-3 mr-1" /> Encerrar SLA
          </Button>
        )}
      </section>

      {/* Encerrar SLA dialog */}
      <AlertDialog open={pauseSlaOpen} onOpenChange={setPauseSlaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar SLA desta demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              O contador de SLA para de rodar imediatamente, independentemente da coluna.
              A demanda continua aberta no board normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="sla-pause-reason" className="text-xs">Motivo (opcional)</Label>
            <Textarea
              id="sla-pause-reason"
              value={pauseSlaReason}
              onChange={(e) => setPauseSlaReason(e.target.value)}
              placeholder="Ex.: aguardando definição do cliente, mantida em backlog..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pauseSlaMutation.mutate({ demandId: demand.id, reason: pauseSlaReason });
                setPauseSlaOpen(false);
              }}
            >
              Encerrar SLA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Watchers */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Observadores ({watchers.length})
          </p>
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => toggleWatcherMutation.mutate(isWatching)}
            disabled={toggleWatcherMutation.isPending}
          >
            {isWatching ? <><EyeOff className="h-3 w-3" /></> : <><Eye className="h-3 w-3" /></>}
          </Button>
        </div>
        {watchers.length > 0 && (
          <div className="space-y-1.5">
            {watchers.map((w) => (
              <AssigneeDisplay
                key={w.id}
                fullName={w.full_name}
                email={w.email}
                size="sm"
              />
            ))}
          </div>
        )}
      </section>

      {/* Dependências */}
      <DemandDependenciesSection demandId={demand.id} />
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Atividade recente
          </p>
          {activities.length > 0 && (
            <Button
              variant="link" size="sm" className="h-auto p-0 text-xs"
              onClick={onActivityTabSelect}
            >
              Ver tudo
            </Button>
          )}
        </div>
        {recentActivities.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem atividade</p>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((act) => (
              <div key={act.id} className="text-xs">
                <p className="text-foreground line-clamp-2">{act.description}</p>
                {act.created_at && (
                  <p className="text-muted-foreground">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setCancelDialogOpen(true)}>
          <X className="h-3 w-3 mr-1" /> Cancelar demanda
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="w-full h-8 text-xs">
              <Trash2 className="h-3 w-3 mr-1" /> Excluir demanda
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { deleteMutation.mutate(demand.id, { onSuccess: onClose }); }}>
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Marcar como bloqueado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de bloqueio *</Label>
              <Select value={selectedBlockerType} onValueChange={setSelectedBlockerType}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {blockerTypes.map((bt) => (
                    <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const selected = blockerTypes.find((b) => b.id === selectedBlockerType);
              const requiresReason = selected?.requires_reason === true;
              return (
                <div className="space-y-1">
                  <Label className="text-xs">{requiresReason ? "Motivo *" : "Motivo (opcional)"}</Label>
                  <Textarea
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    rows={3}
                    placeholder={requiresReason ? "Descreva o motivo do bloqueio..." : "Detalhes do bloqueio..."}
                  />
                </div>
              );
            })()}
            {blockDialogOpen && (
              <BlockerCauseSuggestions
                demandId={demand.id}
                currentReason={blockerReason}
                onPick={(title) => setBlockerReason(`Aguardando: ${title}`)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleBlock} disabled={!selectedBlockerType || blockLoading || (blockerTypes.find((b) => b.id === selectedBlockerType)?.requires_reason === true && !blockerReason.trim())}>
              {blockLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancelar demanda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Motivo *</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cliente mudou de escopo">Cliente mudou de escopo</SelectItem>
                  <SelectItem value="Duplicata de outra demanda">Duplicata de outra demanda</SelectItem>
                  <SelectItem value="Sem resposta do cliente">Sem resposta do cliente</SelectItem>
                  <SelectItem value="Revisão estratégica">Revisão estratégica</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cancelReason === "outro" && (
              <Textarea value={cancelOther} onChange={(e) => setCancelOther(e.target.value)} placeholder="Descreva o motivo..." rows={3} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason || (cancelReason === "outro" && !cancelOther.trim()) || cancelLoading}
            >
              {cancelLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rfiData && (
        <RfiDetailSheet
          open={rfiSheetOpen}
          onOpenChange={setRfiSheetOpen}
          rfi={rfiData as Parameters<typeof RfiDetailSheet>[0]["rfi"]}
          demandTitle={demand.title}
          clientName={demand.clients?.name ?? undefined}
        />
      )}
    </aside>
  );
}

function TimeTrackingWidget({ demandId }: { demandId: string }) {
  const { data: taskStats } = useDemandTaskStats(demandId);
  const { data: totalHours = 0 } = useDemandTotalHours(demandId);
  const addManual = useAddManualEntry();
  const [manualHours, setManualHours] = useState("");
  const hasTasks = (taskStats?.total ?? 0) > 0;

  if (!hasTasks) {
    return <DemandTimeTrackingSection demandId={demandId} />;
  }

  const submitManual = () => {
    const v = parseFloat(manualHours.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    addManual.mutate(
      { demandId, taskId: null, hours: v },
      { onSuccess: () => setManualHours("") },
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tempo total
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total registrado</span>
        <span className="text-sm font-semibold text-foreground">
          {formatHours(totalHours)}
        </span>
      </div>
      <div className="pt-2 border-t border-border/50 space-y-2">
        <p className="text-xs text-muted-foreground">Adicionar horas à demanda</p>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.25"
            min="0"
            placeholder="Horas"
            value={manualHours}
            onChange={(e) => setManualHours(e.target.value)}
            className="h-8 flex-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={submitManual}
            disabled={!manualHours || addManual.isPending}
          >
            {addManual.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BlockerCauseSuggestions({
  demandId,
  currentReason,
  onPick,
}: {
  demandId: string;
  currentReason: string;
  onPick: (title: string) => void;
}) {
  const { data: rels } = useDemandRelationships(demandId);
  const causes = [
    ...(rels?.blocked_by ?? []),
    ...(rels?.related ?? []),
  ].filter((d) => !d.finished_at);

  if (causes.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Demandas relacionadas que podem ser a causa:
      </p>
      <div className="space-y-1">
        {causes.map((c) => {
          const selected = currentReason.includes(c.title);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.title)}
              className={cn(
                "w-full text-left text-xs px-3 py-2 rounded-md border transition-all",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="font-medium">{c.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
