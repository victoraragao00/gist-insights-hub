import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown, { Components } from "react-markdown";

const markdownComponents: Components = {
  a: ({ node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80" />
  ),
  img: ({ node, ...props }) => (
    <img {...props} className="rounded-lg max-w-full h-auto my-2" loading="lazy" />
  ),
};
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight, ChevronDown, ChevronUp, Loader2, Sparkles,
  Trash2, Plus, ArrowRight, ExternalLink, Check, Building2, Users, Pencil,
} from "lucide-react";

import { useMeetingAgenda, useUpdateAgenda, useDeleteAgenda } from "@/hooks/useMeetingAgendas";
import { useMeetingHomework, useCreateHomeworkItem, useDeleteHomeworkItem, type HomeworkItem } from "@/hooks/useMeetingHomework";
import { useMeetingParticipants } from "@/hooks/useMeetingParticipants";
import { useProcessTranscription, useConvertHomeworkToTicket } from "@/hooks/useMeetingAI";
import { SatisfactionPicker } from "@/components/agendas/SatisfactionPicker";
import { useClient } from "@/context/ClientContext";
import { useCreateDemand, useTicketColumns, useDemandTypes } from "@/hooks/useDemands";
import { useDemandAreas } from "@/hooks/useDemandAreas";

const AgendaDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agenda, isLoading } = useMeetingAgenda(id ?? null);
  const { data: homeworkItems = [] } = useMeetingHomework(id ?? null);
  const { data: participants = [] } = useMeetingParticipants(id ?? null);

  const updateAgenda = useUpdateAgenda();
  const deleteAgenda = useDeleteAgenda();
  const processTranscription = useProcessTranscription();
  const createHomework = useCreateHomeworkItem();
  const deleteHomework = useDeleteHomeworkItem();
  const convertToTicket = useConvertHomeworkToTicket();

  // Editable state
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [objective, setObjective] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [summary, setSummary] = useState("");
  const [transcription, setTranscription] = useState("");

  // Edit mode toggles
  const [editingField, setEditingField] = useState<string | null>(null);

  // Homework
  const [newItemText, setNewItemText] = useState("");
  const [newItemSide, setNewItemSide] = useState("umode");
  const [showAddItem, setShowAddItem] = useState(false);

  // Ticket conversion
  const [createDemandOpen, setCreateDemandOpen] = useState(false);
  const [ticketPrefill, setTicketPrefill] = useState<{
    title: string; clientId: string; notes: string; homeworkItemId: string;
  } | null>(null);

  // Collapsible states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    objective: false,
    context: false,
    nextSteps: false,
    homework: true,
    transcription: false,
  });

  // Sync state from query
  useEffect(() => {
    if (!agenda) return;
    setTitle(agenda.title ?? "");
    setLocation(agenda.location ?? "");
    setDuration(agenda.duration_minutes ?? 60);
    setObjective(agenda.objective ?? "");
    setContextNotes(agenda.context_notes ?? "");
    setNextSteps(agenda.next_steps ?? "");
    setSummary(agenda.executive_summary ?? "");
    setTranscription(agenda.transcription ?? "");
  }, [agenda?.id]);

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const saveField = (field: string, value: string | number | null) => {
    if (!id) return;
    updateAgenda.mutate({ id, [field]: value });
  };

  const handleBlurField = (field: string, value: string, original: string | null, dbField: string) => {
    setEditingField(null);
    if (value === (original ?? "")) return;
    saveField(dbField, value || null);
  };

  const handleProcessAI = () => {
    if (!id || !transcription.trim()) return;
    updateAgenda.mutate(
      { id, transcription },
      {
        onSuccess: () => {
          processTranscription.mutate({ agendaId: id, transcription });
        },
      }
    );
  };

  const handleSaveSatisfaction = (score: number) => {
    if (!id) return;
    updateAgenda.mutate({ id, satisfaction_score: score });
  };

  const handleAddHomeworkItem = () => {
    if (!id || !newItemText.trim()) return;
    createHomework.mutate({
      agenda_id: id,
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
    if (!id) return;
    deleteAgenda.mutate(id, {
      onSuccess: () => navigate("/agendas"),
    });
  };

  const umodeItems = homeworkItems.filter((i) => i.responsible_side === "umode");
  const clientItems = homeworkItems.filter((i) => i.responsible_side === "client");
  const isProcessing = processTranscription.isPending;

  const getPreview = (text: string) => {
    if (!text) return "Não preenchido";
    const firstLine = text.split("\n")[0];
    return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agenda) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-medium">Pauta não encontrada</p>
        <Button variant="link" onClick={() => navigate("/agendas")} className="mt-2">
          Voltar para Pautas
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/agendas")} className="hover:text-foreground transition-colors">
          Pautas
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium truncate max-w-[300px]">{agenda.title}</span>
      </nav>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Title - editable */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {editingField === "title" ? (
                <Input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => handleBlurField("title", title, agenda.title, "title")}
                  className="text-xl font-bold"
                />
              ) : (
                <h1
                  className="text-xl font-bold text-foreground cursor-pointer hover:text-primary/80 transition-colors"
                  onClick={() => setEditingField("title")}
                >
                  {title || "Sem título"}
                  <Pencil className="inline-block h-3.5 w-3.5 ml-2 text-muted-foreground" />
                </h1>
              )}
            </div>
            {agenda.ai_processed && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                ✨ IA
              </Badge>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{agenda.clients?.name ?? "—"}</span>
            <span>
              {new Date(agenda.meeting_date).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>

            {/* Location - editable */}
            {editingField === "location" ? (
              <Input
                autoFocus
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => handleBlurField("location", location, agenda.location, "location")}
                placeholder="Local"
                className="w-40 h-7 text-sm"
              />
            ) : (
              <span
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setEditingField("location")}
              >
                {location || "Local não definido"}
                <Pencil className="inline-block h-3 w-3 ml-1" />
              </span>
            )}

            {/* Duration - editable */}
            {editingField === "duration" ? (
              <Input
                autoFocus
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
                onBlur={() => {
                  setEditingField(null);
                  if (duration === (agenda.duration_minutes ?? 60)) return;
                  saveField("duration_minutes", duration || null);
                }}
                className="w-20 h-7 text-sm"
              />
            ) : (
              <span
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setEditingField("duration")}
              >
                {duration} min
                <Pencil className="inline-block h-3 w-3 ml-1" />
              </span>
            )}
          </div>

          {/* Satisfaction */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Satisfação</Label>
            <SatisfactionPicker value={agenda.satisfaction_score} onChange={handleSaveSatisfaction} />
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Resumo Executivo</Label>
            {!agenda.ai_processed && transcription.trim() && (
              <Button
                size="sm"
                onClick={handleProcessAI}
                disabled={isProcessing}
                className="gap-1.5"
              >
                {isProcessing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Processar com IA</>
                )}
              </Button>
            )}
            {agenda.ai_processed && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleProcessAI}
                disabled={isProcessing}
                className="gap-1.5"
              >
                {isProcessing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reprocessando...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Reprocessar</>
                )}
              </Button>
            )}
          </div>

          {editingField === "summary" ? (
            <Textarea
              autoFocus
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onBlur={() => handleBlurField("summary", summary, agenda.executive_summary, "executive_summary")}
              placeholder="Resumo executivo..."
              className="min-h-[120px] text-sm bg-background"
            />
          ) : (
            <div
              className="cursor-pointer rounded-md p-2 hover:bg-primary/10 transition-colors min-h-[40px]"
              onClick={() => setEditingField("summary")}
            >
              {summary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown components={markdownComponents}>{summary}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Clique para adicionar resumo executivo...</p>
              )}
            </div>
          )}

          {agenda.ai_processed && agenda.ai_processed_at && (
            <p className="text-xs text-muted-foreground">
              Último processamento: {new Date(agenda.ai_processed_at).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Collapsible Sections */}
      <CollapsibleSection
        title="Objetivo"
        isOpen={openSections.objective}
        onToggle={() => toggleSection("objective")}
        preview={getPreview(objective)}
        isEditing={editingField === "objective"}
        onStartEdit={() => setEditingField("objective")}
        value={objective}
        onChange={setObjective}
        onBlur={() => handleBlurField("objective", objective, agenda.objective, "objective")}
        placeholder="Objetivo da reunião..."
      />

      <CollapsibleSection
        title="Notas de Contexto"
        isOpen={openSections.context}
        onToggle={() => toggleSection("context")}
        preview={getPreview(contextNotes)}
        isEditing={editingField === "context"}
        onStartEdit={() => setEditingField("context")}
        value={contextNotes}
        onChange={setContextNotes}
        onBlur={() => handleBlurField("context", contextNotes, agenda.context_notes, "context_notes")}
        placeholder="Contexto relevante..."
      />

      <CollapsibleSection
        title="Próximos Passos"
        isOpen={openSections.nextSteps}
        onToggle={() => toggleSection("nextSteps")}
        preview={getPreview(nextSteps)}
        isEditing={editingField === "nextSteps"}
        onStartEdit={() => setEditingField("nextSteps")}
        value={nextSteps}
        onChange={setNextSteps}
        onBlur={() => handleBlurField("nextSteps", nextSteps, agenda.next_steps, "next_steps")}
        placeholder="Próximos passos definidos..."
      />

      {/* Homework - Collapsible */}
      <Card>
        <Collapsible open={openSections.homework} onOpenChange={() => toggleSection("homework")}>
          <CollapsibleTrigger className="w-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {openSections.homework ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="text-sm font-semibold">Lições de Casa</span>
                <Badge variant="secondary" className="text-xs">{homeworkItems.length}</Badge>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddItem(true)} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Adicionar item
                </Button>
              </div>

              {showAddItem && (
                <div className="flex items-end gap-2 p-3 rounded-md border border-border bg-muted/30">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="Descrição do item..."
                    className="text-sm flex-1"
                  />
                  <Select value={newItemSide} onValueChange={setNewItemSide}>
                    <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="umode">uMode</SelectItem>
                      <SelectItem value="client">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAddHomeworkItem} disabled={!newItemText.trim() || createHomework.isPending}>
                    {createHomework.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddItem(false); setNewItemText(""); }}>✕</Button>
                </div>
              )}

              {umodeItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> uMode ({umodeItems.length})
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

              {clientItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Cliente ({clientItems.length})
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
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Transcription - Collapsible */}
      <Card>
        <Collapsible open={openSections.transcription} onOpenChange={() => toggleSection("transcription")}>
          <CollapsibleTrigger className="w-full">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {openSections.transcription ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="text-sm font-semibold">Transcrição</span>
              </div>
              {!openSections.transcription && transcription && (
                <span className="text-xs text-muted-foreground truncate max-w-[300px]">{getPreview(transcription)}</span>
              )}
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <Textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                onBlur={() => {
                  if (transcription === (agenda.transcription ?? "")) return;
                  saveField("transcription", transcription || null);
                }}
                placeholder="Cole aqui a transcrição do Tactiq ou de outra ferramenta..."
                className="min-h-[200px] text-sm"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleProcessAI}
                  disabled={isProcessing || !transcription.trim()}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> {agenda.ai_processed ? "Reprocessar com IA" : "Processar com IA"}</>
                  )}
                </Button>
                {agenda.ai_processed && agenda.ai_processed_at && (
                  <span className="text-xs text-muted-foreground">
                    Último: {new Date(agenda.ai_processed_at).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Participants */}
      {participants.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-semibold mb-2 block">Participantes</Label>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.participant_name || p.user_name || "—"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete */}
      <div className="flex justify-end pb-8">
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

      {/* Create Demand Dialog for homework → ticket */}
      {ticketPrefill && (
        <CreateDemandDialogInline
          open={createDemandOpen}
          onOpenChange={setCreateDemandOpen}
          defaultClientId={ticketPrefill.clientId}
          defaultTitle={ticketPrefill.title}
          defaultNotes={ticketPrefill.notes}
          onCreated={(demandId) => {
            convertToTicket.mutate({
              homeworkItemId: ticketPrefill.homeworkItemId,
              agendaId: id!,
              demandId,
            });
            setTicketPrefill(null);
          }}
        />
      )}
    </div>
  );
};

export default AgendaDetailPage;

// ── Collapsible Section Component ──

function CollapsibleSection({
  title, isOpen, onToggle, preview, isEditing, onStartEdit,
  value, onChange, onBlur, placeholder,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  preview: string;
  isEditing: boolean;
  onStartEdit: () => void;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="text-sm font-semibold">{title}</span>
            </div>
            {!isOpen && (
              <span className="text-xs text-muted-foreground truncate max-w-[400px]">{preview}</span>
            )}
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            {isEditing ? (
              <Textarea
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                className="min-h-[100px] text-sm"
              />
            ) : (
              <div
                className="cursor-pointer rounded-md p-2 hover:bg-muted/50 transition-colors min-h-[40px]"
                onClick={onStartEdit}
              >
                {value ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown>{value}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Clique para editar...</p>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ── Homework Item Row ──

function HomeworkItemRow({
  item, onConvert, onDelete,
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
          <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={onConvert}>
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

// ── Create Demand Dialog (inline copy for ticket conversion) ──

function CreateDemandDialogInline({
  open, onOpenChange, defaultClientId, defaultTitle, defaultNotes, onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClientId: string;
  defaultTitle: string;
  defaultNotes: string;
  onCreated: (demandId: string) => void;
}) {
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: areas = [] } = useDemandAreas();
  const createMutation = useCreateDemand();

  const [title, setTitle] = useState(defaultTitle);
  const [typeId, setTypeId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setTitle(defaultTitle);
    setTypeId("");
    setAreaId("");
    setPriority("medium");
  }
  if (!open && prevOpen) setPrevOpen(false);

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
                  {types.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Área *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
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
          <p className="text-xs text-muted-foreground">Nota: {defaultNotes}</p>
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
