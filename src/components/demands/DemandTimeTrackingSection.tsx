import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Play, Square, Plus, Trash2, Loader2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
  useDemandTimeEntries, useActiveTimerEntry, useUserActiveTimer,
  useDemandTotalHours, useStartTimer, useStopTimer, useAddManualEntry,
  useDeleteTimeEntry, entryHours,
} from "@/hooks/useDemandTimeEntries";
import { formatHours, formatStopwatch } from "@/lib/formatHours";

interface Props {
  demandId: string;
  taskId?: string | null;
}

export function DemandTimeTrackingSection({ demandId, taskId = null }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: entries = [] } = useDemandTimeEntries(demandId);
  const { data: activeEntry } = useActiveTimerEntry({ demandId, taskId });
  const { data: userActiveTimer } = useUserActiveTimer();
  const { data: totalHours = 0 } = useDemandTotalHours(demandId);

  const startMutation = useStartTimer();
  const stopMutation = useStopTimer();
  const addManualMutation = useAddManualEntry();
  const deleteMutation = useDeleteTimeEntry();

  const [manualHours, setManualHours] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [listOpen, setListOpen] = useState(false);

  // Live stopwatch tick
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeEntry?.started_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.started_at]);

  const elapsedSeconds = useMemo(() => {
    if (!activeEntry?.started_at) return 0;
    return Math.floor((now - new Date(activeEntry.started_at).getTime()) / 1000);
  }, [activeEntry?.started_at, now]);

  const otherTimerActive = !!userActiveTimer && !activeEntry;

  const handleAddManual = () => {
    const hours = Number(manualHours.replace(",", "."));
    if (!hours || hours <= 0) return;
    addManualMutation.mutate(
      { demandId, taskId, hours, description: manualDescription },
      {
        onSuccess: () => {
          setManualHours("");
          setManualDescription("");
        },
      }
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> Tempo trabalhado
          </h3>
          <span className="text-sm font-medium text-foreground">
            Σ {formatHours(totalHours)}
          </span>
        </div>

        {/* Timer controls */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          {activeEntry ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-lg tabular-nums text-foreground">
                  {formatStopwatch(elapsedSeconds)}
                </span>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => stopMutation.mutate({ entryId: activeEntry.id })}
                disabled={stopMutation.isPending}
              >
                {stopMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                )}
                Finalizar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Nenhum timer rodando</span>
              {otherTimerActive ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" disabled>
                        <Play className="h-3.5 w-3.5 mr-1.5" /> Iniciar timer
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Você já tem um timer ativo em outra demanda. Finalize antes de iniciar.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  onClick={() => startMutation.mutate({ demandId })}
                  disabled={startMutation.isPending}
                >
                  {startMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Iniciar timer
                </Button>
              )}
            </div>
          )}

          {otherTimerActive && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                Timer ativo em &ldquo;{userActiveTimer?.demand_title ?? "outra demanda"}&rdquo;
              </span>
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => navigate(`/demands/${userActiveTimer!.demand_id}`)}
              >
                Ir
              </Button>
            </div>
          )}
        </div>

        {/* Manual entry */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Adicionar manual</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.25"
              placeholder="Horas"
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              className="h-8 w-24"
            />
            <Input
              placeholder="Descrição (opcional)"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="h-8 flex-1"
            />
            <Button
              size="sm"
              onClick={handleAddManual}
              disabled={addManualMutation.isPending || !manualHours}
            >
              {addManualMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Entries list */}
        {entries.length > 0 && (
          <div className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              className="flex w-full items-center justify-between p-3 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <span>{entries.length} entrada{entries.length === 1 ? "" : "s"}</span>
              {listOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {listOpen && (
              <>
                <Separator />
                <ul className="divide-y">
                  {entries.map((entry) => {
                    const isMine = entry.user_id === user?.id;
                    const hours = entryHours(entry);
                    const isRunning = !!entry.started_at && !entry.ended_at;
                    const author = entry.user_profiles?.full_name ?? entry.user_profiles?.email ?? "Usuário";
                    return (
                      <li key={entry.id} className="flex items-start gap-2 p-3 text-xs">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium text-foreground">{isMine ? "Você" : author}</span>
                            <span>·</span>
                            <span>
                              {entry.created_at
                                ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })
                                : ""}
                            </span>
                            {isRunning && (
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </div>
                          <div className="text-foreground">
                            {isRunning ? "Em andamento" : formatHours(hours)}
                            {entry.hours_manual != null && (
                              <span className="text-muted-foreground"> (manual)</span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-muted-foreground whitespace-pre-wrap">{entry.description}</p>
                          )}
                        </div>
                        {isMine && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover entrada?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ entryId: entry.id })}
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
