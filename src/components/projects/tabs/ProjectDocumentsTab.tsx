import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileText, File, ExternalLink, Trash2, Upload, FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/demands/RichTextEditor";
import {
  useProjectDocuments,
  useCreateProjectDocument,
  useUpdateProjectDocument,
  useDeleteProjectDocument,
  useUploadProjectDocument,
  useSignedProjectDocUrls,
  type ProjectDocument,
} from "@/hooks/useProjectDocuments";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  escopo: { label: "Escopo", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  entregavel: { label: "Entregável", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  nota: { label: "Nota", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  outro: { label: "Outro", color: "bg-muted text-muted-foreground" },
};

interface Props {
  projectId: string;
}

export function ProjectDocumentsTab({ projectId }: Props) {
  const { data: documents = [], isLoading } = useProjectDocuments(projectId);
  const createDoc = useCreateProjectDocument(projectId);
  const updateDoc = useUpdateProjectDocument(projectId);
  const deleteDoc = useDeleteProjectDocument(projectId);
  const uploadDoc = useUploadProjectDocument(projectId);
  const { data: signedUrls = {} } = useSignedProjectDocUrls(documents);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDocument | null>(null);
  const [form, setForm] = useState({ title: "", category: "nota", description: "", url: "" });

  const inlinePrefix = `demands/_drafts/proj-${projectId}/inline`;

  const resetForm = () => setForm({ title: "", category: "nota", description: "", url: "" });

  const handleCreate = () => {
    if (!form.title.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    createDoc.mutate(
      {
        title: form.title.trim(),
        category: form.category,
        description: form.description || null,
        url: form.url.trim() || null,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          resetForm();
        },
      },
    );
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    updateDoc.mutate(
      {
        id: editing.id,
        title: editing.title,
        category: editing.category,
        description: editing.description,
        url: editing.url,
      },
      {
        onSuccess: () => setEditing(null),
      },
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadDoc.mutate(file);
    e.target.value = "";
  };

  const getDocLink = (doc: ProjectDocument) =>
    doc.url || (doc.file_path ? signedUrls[doc.file_path] : null);

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Escopo, entregáveis, notas e arquivos do projeto.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadDoc.isPending}>
            {uploadDoc.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Anexar arquivo
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <FilePlus2 className="h-4 w-4 mr-1" /> Novo documento
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          Nenhum documento ainda. Crie um documento ou anexe um arquivo.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => {
            const cat = CATEGORIES[doc.category] ?? CATEGORIES.outro;
            const link = getDocLink(doc);
            const isFile = !!doc.file_path;
            return (
              <Card key={doc.id} className="border border-border rounded-lg hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                      {isFile ? <File className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setEditing(doc)}
                        className="font-medium text-sm text-left hover:text-primary truncate w-full"
                      >
                        {doc.title}
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-[10px] ${cat.color} border-0`}>{cat.label}</Badge>
                        {doc.file_name && (
                          <span className="text-[10px] text-muted-foreground truncate">{doc.file_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Abrir
                      </a>
                    ) : (
                      <span />
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                          <AlertDialogDescription>"{doc.title}" será removido permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteDoc.mutate({ id: doc.id, filePath: doc.file_path })}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) resetForm(); setCreateOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Link externo</Label>
                <Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Conteúdo</Label>
              <RichTextEditor
                value={form.description}
                onSave={(html) => setForm((p) => ({ ...p, description: html }))}
                uploadPathPrefix={inlinePrefix}
                minHeight={200}
                placeholder="Escreva aqui. Cole imagens diretamente."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createDoc.isPending}>
              {createDoc.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Título</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Link externo</Label>
                  <Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Conteúdo</Label>
                <RichTextEditor
                  value={editing.description ?? ""}
                  onSave={(html) => setEditing({ ...editing, description: html })}
                  uploadPathPrefix={inlinePrefix}
                  minHeight={200}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateDoc.isPending}>
              {updateDoc.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
