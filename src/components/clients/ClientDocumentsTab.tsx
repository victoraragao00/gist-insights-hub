import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileText, Presentation, File, ExternalLink, Trash2, Upload, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useClientDocuments, useCreateDocument, useUpdateDocument,
  useDeleteDocument, useUploadDocument,
} from "@/hooks/useClientDocuments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  contrato: { label: "Contrato", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: <FileText className="h-5 w-5" /> },
  proposta: { label: "Proposta", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <File className="h-5 w-5" /> },
  apresentacao: { label: "Apresentação", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: <Presentation className="h-5 w-5" /> },
  outro: { label: "Outro", color: "bg-muted text-muted-foreground", icon: <File className="h-5 w-5" /> },
};

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  clientId: string;
}

export function ClientDocumentsTab({ clientId }: Props) {
  const { user } = useAuth();
  const { data: documents = [], isLoading } = useClientDocuments(clientId);
  const createDoc = useCreateDocument(clientId);
  const updateDoc = useUpdateDocument(clientId);
  const deleteDoc = useDeleteDocument(clientId);
  const uploadDoc = useUploadDocument(clientId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "outro", description: "", url: "", assignee_id: "" });

  const { data: users = [] } = useQuery<UserProfile[]>({
    queryKey: ["user_profiles_list", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("active", true)
        .order("full_name")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as UserProfile[];
    },
  });

  const handleAddLink = () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    createDoc.mutate({
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      url: form.url.trim() || undefined,
      assignee_id: form.assignee_id || null,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setForm({ title: "", category: "outro", description: "", url: "", assignee_id: "" });
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadDoc.mutate(file);
    e.target.value = "";
  };

  const getDocUrl = (doc: typeof documents[0]) => {
    if (doc.url) return doc.url;
    if (doc.file_path) {
      const { data } = supabase.storage.from("client-documents").getPublicUrl(doc.file_path);
      return data?.publicUrl ?? null;
    }
    return null;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Carregando documentos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Documentos</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Link2 className="h-4 w-4 mr-1" /> Adicionar link
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadDoc.isPending}>
            {uploadDoc.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Upload arquivo
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>Nenhum documento adicionado ainda.</p>
          <Button variant="link" size="sm" className="mt-2" onClick={() => setDialogOpen(true)}>
            Adicionar primeiro documento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const cat = CATEGORY_CONFIG[doc.category] ?? CATEGORY_CONFIG.outro;
            const link = getDocUrl(doc);
            return (
              <Card key={doc.id} className="border border-border rounded-xl hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <input
                        className="font-medium text-sm w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1 -ml-1"
                        defaultValue={doc.title}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== doc.title) updateDoc.mutate({ id: doc.id, title: val });
                        }}
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${cat.color} border-0`}>{cat.label}</Badge>
                        {doc.file_name && (
                          <span className="text-xs text-muted-foreground">{formatSize(doc.file_size_bytes)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {doc.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
                  )}

                  {doc.assignee && (
                    <p className="text-xs text-muted-foreground">
                      👤 {doc.assignee.full_name ?? doc.assignee.email}
                    </p>
                  )}

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
                          <AlertDialogDescription>
                            O documento "{doc.title}" será removido permanentemente.
                          </AlertDialogDescription>
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

      {/* Dialog: Adicionar Link */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar documento (link)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>URL</Label>
              <Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select value={form.assignee_id} onValueChange={(v) => setForm((p) => ({ ...p, assignee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddLink} disabled={createDoc.isPending}>
              {createDoc.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
