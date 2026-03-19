import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle as DlgTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, ArrowRightLeft, User, Lock, Unlock, Edit, Trash2, Loader2,
  FileText, Link2, Upload, ExternalLink, X, MessageSquare, Eye, EyeOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useTicketColumns, useDemandTypes, useDemandActivities,
  useUpdateDemand, useMoveDemand, useDeleteDemand,
  type DemandRow,
} from "@/hooks/useDemands";
import { useDemandAreas } from "@/hooks/useDemandAreas";
import { useDemandAssignees } from "@/hooks/useDemandAssignees";
import {
  useDemandAttachments, useUploadAttachments, useAddLink, useDeleteAttachment,
} from "@/hooks/useDemandAttachments";
import {
  useDemandInteractions, useUnlinkInteraction,
} from "@/hooks/useDemandInteractions";
import {
  useDemandComments, useCreateComment, useUpdateComment, useDeleteComment,
  type DemandComment,
} from "@/hooks/useDemandComments";
import { useDemandWatchers, useToggleWatcher } from "@/hooks/useDemandWatchers";
import { LinkConversationDialog } from "./LinkConversationDialog";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  moved: ArrowRightLeft,
  assigned: User,
  blocked: Lock,
  unblocked: Unlock,
  edited: Edit,
  linked_interaction: Link2,
  commented: MessageSquare,
};

const ACCEPTED_FILE_TYPES = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv";

const SIDE_BADGE: Record<string, string> = {
  client: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  umode: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

interface DemandDetailSheetProps {
  demand: DemandRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemandDetailSheet({ demand, open, onOpenChange }: DemandDetailSheetProps) {
  if (!demand) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Detalhes da Demanda</SheetTitle>
        </SheetHeader>
        <DemandDetailContent demand={demand} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── CommentItem ──

function CommentItem({
  comment,
  demandId,
  currentUserId,
}: {
  comment: DemandComment;
  demandId: string;
  currentUserId: string | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const isOwner = comment.created_by === currentUserId;

  const handleSave = () => {
    if (!editContent.trim() || editContent === comment.content) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(
      { id: comment.id, demandId, content: editContent.trim() },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="flex gap-2 text-xs group">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
        {(comment.created_by ?? "?")[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {isOwner ? "Você" : (comment.created_by?.slice(0, 8) ?? "Usuário")}
          </span>
          {comment.created_at && (
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          )}
          {comment.edited && (
            <Badge variant="outline" className="text-xs px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
              editado
            </Badge>
          )}
          {isOwner && !editing && (
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost" size="icon" className="h-5 w-5"
                onClick={() => { setEditContent(comment.content); setEditing(true); }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ id: comment.id, demandId })}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-1.5 mt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm" className="h-6 text-xs px-2"
                onClick={handleSave}
                disabled={updateMutation.isPending || !editContent.trim()}
              >
                {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Salvar
              </Button>
              <Button
                variant="ghost" size="sm" className="h-6 text-xs px-2"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>
    </div>
  );
}

// ── DemandDetailContent ──

function DemandDetailContent({ demand, onClose }: { demand: DemandRow; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: columns = [] } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: areas = [] } = useDemandAreas();
  const { data: assignees = [] } = useDemandAssignees();
  const { data: activities = [] } = useDemandActivities(demand.id);
  const { data: attachments = [] } = useDemandAttachments(demand.id);
  const { data: linkedInteractions = [] } = useDemandInteractions(demand.id);
  const { data: comments = [] } = useDemandComments(demand.id);
  const { data: watchers = [] } = useDemandWatchers(demand.id);
  const toggleWatcherMutation = useToggleWatcher(demand.id);

  const updateMutation = useUpdateDemand();
  const moveMutation = useMoveDemand();
  const deleteMutation = useDeleteDemand();
  const uploadMutation = useUploadAttachments();
  const addLinkMutation = useAddLink();
  const deleteAttachmentMutation = useDeleteAttachment();
  const unlinkMutation = useUnlinkInteraction();
  const createCommentMutation = useCreateComment();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(demand.title);
  const [description, setDescription] = useState(demand.description ?? "");
  const [expectedResult, setExpectedResult] = useState(demand.expected_result ?? "");
  const [notes, setNotes] = useState(demand.notes ?? "");
  const [rfiUrl, setRfiUrl] = useState(demand.rfi_url ?? "");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  // Block dialog state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockerReason, setBlockerReason] = useState("");
  const [blockedBy, setBlockedBy] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOther, setCancelOther] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const isWatching = watchers.some((w) => w.user_id === user?.id);
  const [linkConvOpen, setLinkConvOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Re-sync local state when demand prop updates
  useEffect(() => {
    setTitle(demand.title);
    setDescription(demand.description ?? "");
    setExpectedResult(demand.expected_result ?? "");
    setNotes(demand.notes ?? "");
    setRfiUrl(demand.rfi_url ?? "");
  }, [demand.id, demand.title, demand.description, demand.expected_result, demand.notes, demand.rfi_url]);

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const saveField = useCallback((field: string, value: string, label: string) => {
    updateMutation.mutate({ id: demand.id, fields: { [field]: value || null }, fieldLabel: label });
  }, [demand.id, updateMutation]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    uploadMutation.mutate({ demandId: demand.id, files: Array.from(files) });
    e.target.value = "";
  };

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    addLinkMutation.mutate(
      { demandId: demand.id, url: newLinkUrl.trim() },
      { onSuccess: () => { setNewLinkUrl(""); setLinkDialogOpen(false); } }
    );
  };

  const handlePostComment = () => {
    if (!newComment.trim() || createCommentMutation.isPending) return;
    createCommentMutation.mutate(
      { demandId: demand.id, content: newComment.trim() },
      { onSuccess: () => setNewComment("") }
    );
  };

  const handleBlock = async () => {
    if (!blockerReason.trim()) return;
    setBlockLoading(true);
    try {
      const { error } = await supabase
        .from("demands")
        .update({ is_blocked: true, blocked_at: new Date().toISOString(), blocker_reason: blockerReason.trim(), blocked_by: blockedBy.trim() || null })
        .eq("id", demand.id);
      if (error) throw error;
      await supabase.from("demand_activities").insert({
        demand_id: demand.id,
        event_type: "blocked",
        description: `Bloqueado: ${blockerReason.trim()}`,
        created_by: user?.id,
      });
      toast.success("Demanda marcada como bloqueada");
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      queryClient.invalidateQueries({ queryKey: ["client_demands"] });
      setBlockDialogOpen(false);
      setBlockerReason("");
      setBlockedBy("");
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
        .update({ is_blocked: false, blocked_at: null, blocker_reason: null, blocked_by: null })
        .eq("id", demand.id);
      if (error) throw error;
      await supabase.from("demand_activities").insert({
        demand_id: demand.id,
        event_type: "unblocked",
        description: "Desbloqueado",
        created_by: user?.id,
      });
      toast.success("Demanda desbloqueada");
      queryClient.invalidateQueries({ queryKey: ["demands"] });
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
      // Find the "Cancelado" column
      const cancelCol = columns.find((c) => c.name.toLowerCase().includes("cancelad"));
      const { error } = await supabase
        .from("demands")
        .update({ cancellation_reason: reason, ...(cancelCol ? { column_id: cancelCol.id } : {}) })
        .eq("id", demand.id);
      if (error) throw error;
      await supabase.from("demand_activities").insert({
        demand_id: demand.id,
        event_type: "cancelled",
        description: `Cancelado: ${reason}`,
        created_by: user?.id,
      });
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

  // Group linked interactions by conversation_id
  const convGroups = linkedInteractions.reduce<Record<string, typeof linkedInteractions>>((acc, li) => {
    const key = li.interactions?.conversation_id ?? "sem-conversa";
    if (!acc[key]) acc[key] = [];
    acc[key].push(li);
    return acc;
  }, {});

  return (
    <div className="space-y-5 pt-2">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title.trim() && title !== demand.title) saveField("title", title.trim(), "Título");
        }}
        className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 shadow-none"
      />

      {/* Meta */}
      <div className="grid gap-3 sm:grid-cols-2">
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
          <Label className="text-xs text-muted-foreground">Coluna</Label>
          <Select value={demand.column_id} onValueChange={handleColumnChange}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {columns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Select
            value={demand.assignee_id ?? ""}
            onValueChange={(v) => updateMutation.mutate({ id: demand.id, fields: { assignee_id: v || null }, fieldLabel: "Responsável" })}
          >
            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {assignees.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">RFI</Label>
          <div className="flex items-center gap-1.5">
            <Input
              value={rfiUrl}
              onChange={(e) => setRfiUrl(e.target.value)}
              onBlur={() => {
                const normalized = normalizeUrl(rfiUrl);
                if (normalized !== rfiUrl) setRfiUrl(normalized);
                if (normalized !== (demand.rfi_url ?? "")) saveField("rfi_url", normalized, "RFI");
              }}
              className="h-8 flex-1"
              type="url"
              placeholder="https://..."
            />
            {rfiUrl.trim() && (
              <a href={normalizeUrl(rfiUrl)} target="_blank" rel="noopener noreferrer" title="Abrir RFI">
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Cliente: <span className="font-medium text-foreground">{demand.clients?.name ?? "—"}</span>
      </div>

      <Separator />

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Descrição</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (demand.description ?? "")) saveField("description", description, "Descrição");
          }}
          rows={3}
        />
      </div>

      {/* Expected Result */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Resultado Esperado</Label>
        <Textarea
          value={expectedResult}
          onChange={(e) => setExpectedResult(e.target.value)}
          onBlur={() => {
            if (expectedResult !== (demand.expected_result ?? "")) saveField("expected_result", expectedResult, "Resultado Esperado");
          }}
          rows={2}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Notas Internas</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (demand.notes ?? "")) saveField("notes", notes, "Notas");
          }}
          rows={2}
        />
      </div>

      <Separator />

      {/* Attachments & Links */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Anexos e Links</Label>

        {attachments.length === 0 && !uploadMutation.isPending && (
          <p className="text-xs text-muted-foreground">Nenhum anexo</p>
        )}

        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-2 text-xs group">
            {att.type === "file" ? (
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:underline truncate flex-1"
            >
              {att.filename ?? att.url}
            </a>
            {att.size_bytes && (
              <span className="text-muted-foreground shrink-0">{formatBytes(att.size_bytes)}</span>
            )}
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100">
                  <X className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover anexo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {att.type === "file" ? "O arquivo será excluído permanentemente." : "O link será removido."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteAttachmentMutation.mutate(att)}>
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}

        {uploadMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <Upload className="h-3.5 w-3.5 mr-1" /> Arquivos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="h-3.5 w-3.5 mr-1" /> Link
          </Button>
        </div>
      </div>

      {/* Add Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DlgTitle>Adicionar Link</DlgTitle>
          </DialogHeader>
          <Input
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddLink} disabled={!newLinkUrl.trim() || addLinkMutation.isPending}>
              {addLinkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      {/* Conversas Vinculadas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Conversas Vinculadas</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setLinkConvOpen(true)}
          >
            <Link2 className="h-3 w-3 mr-1" /> Vincular conversa
          </Button>
        </div>

        {linkedInteractions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma conversa vinculada</p>
        ) : (
          Object.entries(convGroups).map(([convId, items]) => {
            const firstItem = items[0];
            const firstOccurred = firstItem?.interactions?.occurred_at;
            return (
              <div key={convId} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground truncate">
                    {convId === "sem-conversa" ? "Sem conversa" : convId.slice(0, 24) + "…"}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{items.length} msg</Badge>
                    {firstOccurred && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(firstOccurred), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
                {items.map((li) => (
                  <div key={li.id} className="flex items-start gap-2 text-xs group pl-2 border-l border-border">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{li.interactions?.sender_raw ?? "—"}</span>
                        {li.interactions?.sender_side && (
                          <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${SIDE_BADGE[li.interactions.sender_side] ?? "bg-muted text-muted-foreground"}`}>
                            {li.interactions.sender_side === "client" ? "Cliente" : "uMode"}
                          </span>
                        )}
                        {li.interactions?.occurred_at && (
                          <span className="text-muted-foreground ml-auto shrink-0">
                            {formatDistanceToNow(new Date(li.interactions.occurred_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground line-clamp-2">
                        {li.interactions?.content ?? "—"}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0">
                          <X className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desvincular mensagem?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A mensagem será removida do vínculo com este ticket.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => unlinkMutation.mutate({ id: li.id, demandId: demand.id })}
                          >
                            Desvincular
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            );
          })
        )}

        <LinkConversationDialog
          demand={demand}
          open={linkConvOpen}
          onOpenChange={setLinkConvOpen}
        />
      </div>

      <Separator />

      {/* Comentários */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Comentários</Label>

        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum comentário ainda</p>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              demandId={demand.id}
              currentUserId={user?.id}
            />
          ))}
        </div>

        {/* New comment input */}
        <div className="space-y-1.5">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Adicionar comentário..."
            rows={2}
            className="text-xs"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handlePostComment}
            disabled={!newComment.trim() || createCommentMutation.isPending}
          >
            {createCommentMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Comentar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Timeline */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Atividades</Label>
        {activities.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma atividade registrada</p>
        )}
        {activities.map((act: Tables<"demand_activities">) => {
          const Icon = EVENT_ICONS[act.event_type] ?? Edit;
          return (
            <div key={act.id} className="flex gap-2 items-start text-xs">
              <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-foreground">{act.description}</span>
                {act.created_at && (
                  <span className="text-muted-foreground ml-1.5">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-full">
            <Trash2 className="h-4 w-4 mr-1" /> Excluir Demanda
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A demanda e todas as atividades serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate(demand.id, { onSuccess: onClose });
              }}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
