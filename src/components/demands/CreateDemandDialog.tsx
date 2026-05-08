import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/demands/RichTextEditor";
import { cleanupDraftInlineImages } from "@/hooks/useDemandAttachments";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, MessageSquarePlus } from "lucide-react";
import { useCreateDemand, useTicketColumns, useDemandTypes, type DemandPriority } from "@/hooks/useDemands";
import { useDemandAreas, useAreasByWorkspace } from "@/hooks/useDemandAreas";
import { useClient } from "@/context/ClientContext";
import { useAuth } from "@/context/AuthContext";
import { useDemandAnalysis, useAnalyzeDemand } from "@/hooks/useDemandAnalysis";
import { useCreateRfi, useUpdateRfi } from "@/hooks/useRfis";
import { useAddLink } from "@/hooks/useDemandAttachments";
import { LinkConversationDialog } from "@/components/demands/LinkConversationDialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreateDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultColumnId?: string;
  defaultClientId?: string;
  workspace?: "cx" | "tech";
}

export function CreateDemandDialog({ open, onOpenChange, defaultColumnId, defaultClientId, workspace = "cx" }: CreateDemandDialogProps) {
  const { clients } = useClient();
  const { user } = useAuth();
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: allAreas = [] } = useDemandAreas();
  const { data: workspaceAreas = [] } = useAreasByWorkspace(workspace);
  const areas = workspace === "tech" ? workspaceAreas : allAreas;
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
  const createMutation = useCreateDemand();
  const createRfiMutation = useCreateRfi();
  const updateRfiMutation = useUpdateRfi();
  const addLinkMutation = useAddLink();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [typeId, setTypeId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<DemandPriority>("medium");
  const [columnId, setColumnId] = useState(defaultColumnId ?? "");
  const [description, setDescription] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [notes, setNotes] = useState("");
  const [rfiUrl, setRfiUrl] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [createdDemandId, setCreatedDemandId] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Stable draft id used as inline-image upload prefix before the demand exists.
  const draftIdRef = useRef<string>("");
  if (!draftIdRef.current) draftIdRef.current = crypto.randomUUID();
  const draftPrefix = `demands/_drafts/${draftIdRef.current}/inline`;

  // Pre-fill area if there's exactly 1 area available for this workspace
  useEffect(() => {
    if (areaId || areas.length === 0) return;
    if (workspace === "tech" && areas.length === 1) setAreaId(areas[0].id);
  }, [workspace, areas, areaId]);

  const { data: analysis } = useDemandAnalysis(createdDemandId ?? undefined);
  const analyzeMutation = useAnalyzeDemand();

  const effectiveColumnId = columnId || columns[0]?.id || "";

  const canSubmit = title.trim().length > 0 && clientId && typeId && areaId;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        client_id: clientId,
        demand_type_id: typeId,
        priority,
        column_id: effectiveColumnId,
        area_id: areaId || undefined,
        assignee_id: assigneeId || undefined,
        description: description || undefined,
        expected_result: expectedResult || undefined,
        notes: notes || undefined,
        workspace,
      },
      {
        onSuccess: async (data) => {
          const newId = data?.id;
          if (!newId) {
            onOpenChange(false);
            resetForm();
            return;
          }

          // Side-effects: optional RFI + external link.
          // Do not block the post-creation view if either fails — toasts will surface errors.
          const trimmedRfi = rfiUrl.trim();
          const trimmedLink = externalLink.trim();

          if (trimmedRfi) {
            try {
              const rfi = await createRfiMutation.mutateAsync({ demand_id: newId });
              if (rfi?.id) {
                await updateRfiMutation.mutateAsync({
                  id: rfi.id,
                  demandId: newId,
                  fields: { link: trimmedRfi },
                });
              }
            } catch {
              /* toast already shown by mutation */
            }
          }

          if (trimmedLink) {
            try {
              await addLinkMutation.mutateAsync({ demandId: newId, url: trimmedLink });
            } catch {
              /* toast already shown by mutation */
            }
          }

          setCreatedDemandId(newId);
        },
      }
    );
  };

  const resetForm = () => {
    setTitle("");
    setClientId(defaultClientId ?? "");
    setTypeId("");
    setAreaId("");
    setAssigneeId("");
    setPriority("medium");
    setColumnId(defaultColumnId ?? "");
    setDescription("");
    setExpectedResult("");
    setNotes("");
    setRfiUrl("");
    setExternalLink("");
    setCreatedDemandId(null);
    setShowLinkDialog(false);
    // Rotate draft id so subsequent demand starts with a fresh inline-image namespace.
    draftIdRef.current = crypto.randomUUID();
  };

  // Cancel without creating: best-effort cleanup of orphan inline images.
  const handleCancel = () => {
    const prefix = draftPrefix;
    void cleanupDraftInlineImages(prefix);
    resetForm();
    onOpenChange(false);
  };

  const handleFinish = () => {
    resetForm();
    onOpenChange(false);
  };

  // Post-creation view
  if (createdDemandId) {
    const demandStub = { id: createdDemandId, client_id: clientId } as Parameters<typeof LinkConversationDialog>[0]["demand"];

    return (
      <>
        <Dialog
          open={open && !showLinkDialog}
          onOpenChange={(v) => { if (!v) handleFinish(); else onOpenChange(v); }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Demanda Criada ✓</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A demanda <span className="font-medium text-foreground">{title || "Nova Demanda"}</span> foi criada com sucesso.
              </p>

              {/* Step 2 — optional: link a conversation */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Deseja vincular uma conversa agora?</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Associe mensagens já existentes deste cliente à demanda.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleFinish}>
                    Não, finalizar
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setShowLinkDialog(true)}>
                    Sim, vincular
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Análise IA</Label>
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => analyzeMutation.mutate(createdDemandId)}
                    disabled={analyzeMutation.isPending}
                  >
                    {analyzeMutation.isPending
                      ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analisando...</>
                      : <><Sparkles className="h-3 w-3 mr-1" /> {analysis ? "Reanalisar" : "Analisar com IA"}</>
                    }
                  </Button>
                </div>

                {analysis && (
                  <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-primary">Problema identificado</p>
                      <p className="text-xs text-foreground">{analysis.problem_summary}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-primary">Sugestão de resolução</p>
                      <p className="text-xs text-foreground">{analysis.suggested_resolution}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gerado {formatDistanceToNow(new Date(analysis.generated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={handleFinish}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <LinkConversationDialog
          demand={demandStub}
          open={showLinkDialog}
          onOpenChange={(v) => {
            setShowLinkDialog(v);
            if (!v) handleFinish();
          }}
        />
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); else onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Corrigir erro de login" />
          </div>

          {/* Client + Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          {/* Area + Assignee */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Área Responsável *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {userProfiles.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority + Column */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as DemandPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Coluna inicial</Label>
              <Select value={effectiveColumnId} onValueChange={setColumnId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>



          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <RichTextEditor
              value={description}
              onSave={setDescription}
              uploadPathPrefix={draftPrefix}
              minHeight={96}
              placeholder="Descreva o problema. Cole ou arraste imagens diretamente aqui."
            />
          </div>

          {/* Expected Result */}
          <div className="space-y-1.5">
            <Label>Resultado Esperado</Label>
            <RichTextEditor
              value={expectedResult}
              onSave={setExpectedResult}
              uploadPathPrefix={draftPrefix}
              minHeight={64}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <RichTextEditor
              value={notes}
              onSave={setNotes}
              uploadPathPrefix={draftPrefix}
              minHeight={64}
            />
          </div>

          {/* RFI URL + External Link */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>RFI URL</Label>
              <Input
                type="url"
                value={rfiUrl}
                onChange={(e) => setRfiUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-[10px] text-muted-foreground">
                Cria uma RFI vinculada à demanda com este link.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Link externo</Label>
              <Input
                type="url"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-[10px] text-muted-foreground">
                Adicionado como link nos anexos da demanda.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
