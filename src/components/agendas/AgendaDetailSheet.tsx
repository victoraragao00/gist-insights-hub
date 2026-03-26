import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Trash2, Plus, ArrowRight, ExternalLink, Check, Building2, Users } from "lucide-react";
import { toast } from "sonner";

import { useMeetingAgenda, useUpdateAgenda, useDeleteAgenda, type MeetingAgenda } from "@/hooks/useMeetingAgendas";
import { useMeetingHomework, useCreateHomeworkItem, useDeleteHomeworkItem, type HomeworkItem } from "@/hooks/useMeetingHomework";
import { useMeetingParticipants, useAddMeetingParticipant, useRemoveMeetingParticipant } from "@/hooks/useMeetingParticipants";
import { useProcessTranscription, useConvertHomeworkToTicket } from "@/hooks/useMeetingAI";
import { SatisfactionPicker } from "./SatisfactionPicker";
import { CreateDemandDialog } from "@/components/demands/CreateDemandDialog";

interface AgendaDetailSheetProps {
  agendaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgendaDetailSheet({ agendaId, open, onOpenChange }: AgendaDetailSheetProps) {
  const navigate = useNavigate();
  const { data: agenda, isLoading } = useMeetingAgenda(agendaId);
  const { data: homeworkItems = [] } = useMeetingHomework(agendaId);
  const { data: participants = [] } = useMeetingParticipants(agendaId);

  const updateAgenda = useUpdateAgenda();
  const deleteAgenda = useDeleteAgenda();
  const processTranscription = useProcessTranscription();
  const createHomework = useCreateHomeworkItem();
  const deleteHomework = useDeleteHomeworkItem();
  const convertToTicket = useConvertHomeworkToTicket();

  const [transcriptionDraft, setTranscriptionDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [newItemSide, setNewItemSide] = useState("umode");
  const [showAddItem, setShowAddItem] = useState(false);
  const [createDemandOpen, setCreateDemandOpen] = useState(false);
  const [ticketPrefill, setTicketPrefill] = useState<{ title: string; clientId: string; notes: string; homeworkItemId: string } | null>(null);

  // Sync drafts when agenda loads
  const prevAgendaId = useState<string | null>(null);
  if (agenda && agenda.id !== prevAgendaId[0]) {
    prevAgendaId[1](agenda.id);
    setTranscriptionDraft(agenda.transcription ?? "");
    setSummaryDraft(agenda.executive_summary ?? "");
  }

  const handleProcessAI = () => {
    if (!agendaId || !transcriptionDraft.trim()) return;
    // Save transcription first, then process
    updateAgenda.mutate(
      { id: agendaId, transcription: transcriptionDraft },
      {
        onSuccess: () => {
          processTranscription.mutate({
            agendaId,
            transcription: transcriptionDraft,
          });
        },
      }
    );
  };

  const handleSaveSummary = () => {
    if (!agendaId) return;
    updateAgenda.mutate({ id: agendaId, executive_summary: summaryDraft });
  };

  const handleSaveSatisfaction = (score: number) => {
    if (!agendaId) return;
    updateAgenda.mutate({ id: agendaId, satisfaction_score: score });
  };

  const handleAddHomeworkItem = () => {
    if (!agendaId || !newItemText.trim()) return;
    createHomework.mutate({
      agenda_id: agendaId,
      description: newItemText.trim(),
      responsible_side: newItemSide,
      responsible_label: newItemSide === "umode" ? "uMode" : "Cliente",
    }, {
      onSuccess: () => {
        setNewItemText("");
        setShowAddItem(false);
      },
    });
  };

  const handleConvertToTicket = (item: HomeworkItem) => {
    if (!agenda) return;
    setTicketPrefill({
      title: item.description,
      clientId: agenda.client_id,
      notes: `Originado da pauta: ${agenda.title}`,
      homeworkItemId: item.id,
    });
    setCreateDemandOpen(true);
  };

  const handleDelete = () => {
    if (!agendaId) return;
    deleteAgenda.mutate(agendaId, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const umodeItems = homeworkItems.filter((i) => i.responsible_side === "umode");
  const clientItems = homeworkItems.filter((i) => i.responsible_side === "client");
  const isProcessing = processTranscription.isPending;

  if (!open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">
              {isLoading ? "Carregando..." : agenda?.title ?? "Pauta"}
            </SheetTitle>
          </SheetHeader>

          {agenda && (
            <div className="space-y-6 mt-4">
              {/* Info header */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span>{new Date(agenda.meeting_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                {agenda.location && <span>· {agenda.location}</span>}
                {agenda.ai_processed && (
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                    ✨ Processado por IA
                  </Badge>
                )}
              </div>

              {/* Satisfaction */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Satisfação do cliente</Label>
                <SatisfactionPicker
                  value={agenda.satisfaction_score}
                  onChange={handleSaveSatisfaction}
                />
              </div>

              {/* Objective */}
              {agenda.objective && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Objetivo</Label>
                  <p className="text-sm text-muted-foreground">{agenda.objective}</p>
                </div>
              )}

              <Separator />

              {/* ── Transcription section ── */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Transcrição</Label>
                <Textarea
                  value={transcriptionDraft}
                  onChange={(e) => setTranscriptionDraft(e.target.value)}
                  placeholder="Cole aqui a transcrição do Tactiq ou de outra ferramenta..."
                  className="min-h-[200px] text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleProcessAI}
                    disabled={isProcessing || !transcriptionDraft.trim()}
                    className="gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {agenda.ai_processed ? "Reprocessar com IA" : "Processar com IA"}
                      </>
                    )}
                  </Button>
                  {agenda.ai_processed && agenda.ai_processed_at && (
                    <span className="text-xs text-muted-foreground">
                      Último processamento: {new Date(agenda.ai_processed_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── Executive Summary ── */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Resumo Executivo</Label>
                <Textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  onBlur={handleSaveSummary}
                  placeholder="Gerado pela IA após processar a transcrição, ou escreva manualmente..."
                  className="min-h-[120px] text-sm"
                />
              </div>

              <Separator />

              {/* ── Homework Items ── */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Lições de Casa</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddItem(true)}
                    className="gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" /> Adicionar item
                  </Button>
                </div>

                {/* Add item inline */}
                {showAddItem && (
                  <div className="flex items-end gap-2 p-3 rounded-md border border-border bg-muted/30">
                    <div className="flex-1 space-y-1.5">
                      <Input
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Descrição do item..."
                        className="text-sm"
                      />
                    </div>
                    <Select value={newItemSide} onValueChange={setNewItemSide}>
                      <SelectTrigger className="w-28 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="umode">uMode</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleAddHomeworkItem} disabled={!newItemText.trim() || createHomework.isPending}>
                      {createHomework.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAddItem(false); setNewItemText(""); }}>
                      ✕
                    </Button>
                  </div>
                )}

                {/* uMode items */}
                {umodeItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      uMode ({umodeItems.length})
                    </div>
                    {umodeItems.map((item) => (
                      <HomeworkItemRow
                        key={item.id}
                        item={item}
                        onConvert={() => handleConvertToTicket(item)}
                        onDelete={() => deleteHomework.mutate(item.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Client items */}
                {clientItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Cliente ({clientItems.length})
                    </div>
                    {clientItems.map((item) => (
                      <HomeworkItemRow
                        key={item.id}
                        item={item}
                        onConvert={() => handleConvertToTicket(item)}
                        onDelete={() => deleteHomework.mutate(item.id)}
                      />
                    ))}
                  </div>
                )}

                {homeworkItems.length === 0 && !showAddItem && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma lição de casa. Processe a transcrição com IA ou adicione manualmente.
                  </p>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir pauta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir pauta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é irreversível. Todos os itens de lição de casa e participantes serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Demand Dialog for converting homework to ticket */}
      {ticketPrefill && (
        <CreateDemandDialogWithCallback
          open={createDemandOpen}
          onOpenChange={setCreateDemandOpen}
          defaultClientId={ticketPrefill.clientId}
          defaultTitle={ticketPrefill.title}
          defaultNotes={ticketPrefill.notes}
          onCreated={(demandId) => {
            convertToTicket.mutate({
              homeworkItemId: ticketPrefill.homeworkItemId,
              agendaId: agendaId!,
              demandId,
            });
            setTicketPrefill(null);
          }}
        />
      )}
    </>
  );
}

// ── Homework Item Row ──

function HomeworkItemRow({
  item,
  onConvert,
  onDelete,
}: {
  item: HomeworkItem;
  onConvert: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const isConverted = !!item.converted_to_demand_id;

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-card text-sm">
      <span className={isConverted ? "text-muted-foreground line-through flex-1" : "flex-1"}>
        {item.description}
      </span>
      {isConverted ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs shrink-0"
          onClick={() => navigate(`/demands?demandId=${item.converted_to_demand_id}`)}
        >
          <ExternalLink className="h-3 w-3" /> Ver ticket
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs shrink-0"
            onClick={onConvert}
          >
            <ArrowRight className="h-3 w-3" /> Ticket
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );
}

// ── CreateDemandDialog with callback ──

import { useCreateDemand, useTicketColumns, useDemandTypes } from "@/hooks/useDemands";
import { useDemandAreas } from "@/hooks/useDemandAreas";

function CreateDemandDialogWithCallback({
  open,
  onOpenChange,
  defaultClientId,
  defaultTitle,
  defaultNotes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId: string;
  defaultTitle: string;
  defaultNotes: string;
  onCreated: (demandId: string) => void;
}) {
  const { clients } = useClient();
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: areas = [] } = useDemandAreas();
  const createMutation = useCreateDemand();

  const [title, setTitle] = useState(defaultTitle);
  const [typeId, setTypeId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  // Reset on open
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setTitle(defaultTitle);
    setTypeId("");
    setAreaId("");
    setPriority("medium");
  }
  if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const effectiveColumnId = columns[0]?.id || "";
  const canSubmit = title.trim().length > 0 && typeId && areaId;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        client_id: defaultClientId,
        demand_type_id: typeId,
        priority,
        column_id: effectiveColumnId,
        area_id: areaId || undefined,
        notes: defaultNotes || undefined,
      },
      {
        onSuccess: (data) => {
          onCreated(data.id);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Ticket da Lição de Casa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Área *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high" | "urgent")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Nota: {defaultNotes}
          </p>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Need to import these at the top level for the inner component
import { useClient } from "@/context/ClientContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
