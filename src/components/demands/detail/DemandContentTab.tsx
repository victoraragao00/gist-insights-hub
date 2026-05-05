import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Upload, Link2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUpdateDemand, type DemandRow } from "@/hooks/useDemands";
import {
  useDemandAttachments, useUploadAttachments, useAddLink, useDeleteAttachment,
  useSignedAttachmentUrls,
} from "@/hooks/useDemandAttachments";
import { useDemandAnalysis, useAnalyzeDemand } from "@/hooks/useDemandAnalysis";
import { useAutoResize } from "@/hooks/useAutoResize";
import { AttachmentThumbnail } from "./AttachmentThumbnail";
import { DemandTasksSection } from "./DemandTasksSection";

const ACCEPTED_FILE_TYPES = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv";

interface DemandContentTabProps {
  demand: DemandRow;
}

export function DemandContentTab({ demand }: DemandContentTabProps) {
  const updateMutation = useUpdateDemand();
  const { data: attachments = [] } = useDemandAttachments(demand.id);
  const { data: signedUrlMap = {} } = useSignedAttachmentUrls(attachments);
  const uploadMutation = useUploadAttachments();
  const addLinkMutation = useAddLink();
  const deleteAttachmentMutation = useDeleteAttachment();
  const { data: analysis } = useDemandAnalysis(demand.id);
  const analyzeMutation = useAnalyzeDemand();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(demand.description ?? "");
  const [expectedResult, setExpectedResult] = useState(demand.expected_result ?? "");
  const [notes, setNotes] = useState(demand.notes ?? "");
  const [resolution, setResolution] = useState(demand.resolution ?? "");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const descRef = useAutoResize(description);
  const resultRef = useAutoResize(expectedResult);

  const hasResolution = !!resolution && resolution.trim() !== "";

  useEffect(() => {
    setDescription(demand.description ?? "");
    setExpectedResult(demand.expected_result ?? "");
    setNotes(demand.notes ?? "");
    setResolution(demand.resolution ?? "");
  }, [demand.id, demand.description, demand.expected_result, demand.notes, demand.resolution]);

  const saveField = (field: string, value: string, label: string) => {
    updateMutation.mutate({ id: demand.id, fields: { [field]: value || null }, fieldLabel: label });
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

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Descrição</Label>
        <Textarea
          ref={descRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (demand.description ?? "")) saveField("description", description, "Descrição");
          }}
          placeholder="Descreva a demanda..."
          className="resize-none overflow-hidden min-h-[80px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Resultado esperado</Label>
        <Textarea
          ref={resultRef}
          value={expectedResult}
          onChange={(e) => setExpectedResult(e.target.value)}
          onBlur={() => {
            if (expectedResult !== (demand.expected_result ?? "")) saveField("expected_result", expectedResult, "Resultado Esperado");
          }}
          placeholder="O que precisa ser entregue?"
          className="resize-none overflow-hidden min-h-[80px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Notas internas</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (demand.notes ?? "")) saveField("notes", notes, "Notas");
          }}
          rows={3}
        />
      </div>

      <div
        className={cn(
          "rounded-md border p-3 transition-colors",
          hasResolution
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
            : "border-border bg-background",
        )}
      >
        <Label
          className={cn(
            "text-xs font-medium uppercase tracking-wide mb-2 block",
            hasResolution ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          Resolução
        </Label>
        <Textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          onBlur={() => {
            if (resolution !== (demand.resolution ?? "")) saveField("resolution", resolution, "Resolução");
          }}
          rows={3}
          placeholder="Como foi resolvido..."
          className={cn(
            "border-0 bg-transparent p-0 resize-none focus-visible:ring-0 shadow-none",
            hasResolution ? "text-emerald-900 dark:text-emerald-200" : "",
          )}
        />
      </div>

      {/* AI Analysis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Análise IA</Label>
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => analyzeMutation.mutate(demand.id)}
            disabled={analyzeMutation.isPending}
          >
            {analyzeMutation.isPending
              ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analisando...</>
              : <><Sparkles className="h-3 w-3 mr-1" /> {analysis ? "Reanalisar" : "Analisar com IA"}</>
            }
          </Button>
        </div>

        {analysis && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-primary">Problema identificado</p>
              <p className="text-sm text-foreground">{analysis.problem_summary}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-primary">Sugestão de resolução</p>
              <p className="text-sm text-foreground">{analysis.suggested_resolution}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Gerado {formatDistanceToNow(new Date(analysis.generated_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Anexos e links</Label>
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
              variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-3 w-3 mr-1" /> Arquivo
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLinkDialogOpen(true)}>
              <Link2 className="h-3 w-3 mr-1" /> Link
            </Button>
          </div>
        </div>

        {attachments.length === 0 && !uploadMutation.isPending && (
          <p className="text-xs text-muted-foreground">Nenhum anexo</p>
        )}

        {attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {attachments.map((att) => (
              <div key={att.id} className="relative group">
                <AttachmentThumbnail attachment={att} signedUrl={signedUrlMap[att.id]} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remover anexo"
                    >
                      ×
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
          </div>
        )}

        {uploadMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...
          </div>
        )}
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar link</DialogTitle></DialogHeader>
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
    </div>
  );
}
