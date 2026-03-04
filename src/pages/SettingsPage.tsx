import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
import {
  MessageCircle,
  Phone,
  Hash,
  Mail,
  Mic,
  Download,
  Loader2,
  Check,
  Upload,
  CalendarIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GistContactWizard } from "@/components/GistContactWizard";

// ── Types ──────────────────────────────────────────────

interface ChannelBinding {
  id: string;
  client_id: string;
  channel: string;
  label: string | null;
  active: boolean | null;
}

interface ImportProgress {
  page: number;
  conversations_fetched: number;
  messages_fetched: number;
  done: boolean;
  error?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

// ── Component ──────────────────────────────────────────

const SettingsPage = () => {
  // Gist state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // Upload state
  const [uploadClientId, setUploadClientId] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──

  const { data: gistBindings = [] } = useQuery<ChannelBinding[]>({
    queryKey: ["gist_bindings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_bindings")
        .select("id, client_id, channel, label, active")
        .eq("channel", "gist");
      if (error) throw error;
      return (data ?? []) as ChannelBinding[];
    },
  });

  const hasGist = gistBindings.length > 0;

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ["clients_list"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientOption[];
    },
  });

  // ── Import history ──

  const handleImportHistory = async () => {
    setImporting(true);
    setImportProgress({ page: 1, conversations_fetched: 0, messages_fetched: 0, done: false });

    let page = 1;
    let totalConversations = 0;
    let totalMessages = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        setImportProgress({
          page,
          conversations_fetched: totalConversations,
          messages_fetched: totalMessages,
          done: false,
        });

        const { data, error } = await supabase.functions.invoke("ingest-gist-historical", {
          body: { page },
        });

        if (error) throw new Error(typeof error === "string" ? error : "Erro na importação");

        const result = data as {
          conversations_fetched: number;
          messages_fetched: number;
          messages_inserted: number;
          has_more: boolean;
          next_page?: number;
        } | null;

        if (!result) throw new Error("Resposta vazia");

        totalConversations += result.conversations_fetched;
        totalMessages += result.messages_fetched;
        hasMore = result.has_more;
        page = result.next_page ?? page + 1;
      }

      setImportProgress({
        page,
        conversations_fetched: totalConversations,
        messages_fetched: totalMessages,
        done: true,
      });

      toast.success(
        `✓ Importação concluída: ${totalConversations} conversas, ${totalMessages} mensagens`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setImportProgress((prev) =>
        prev ? { ...prev, done: true, error: msg } : null,
      );
      toast.error("Erro na importação: " + msg);
    } finally {
      setImporting(false);
    }
  };

  // ── Upload handler ──

  const handleUpload = () => {
    toast.info("Em breve: importação de transcrições será implementada.");
  };

  const canUpload =
    uploadClientId && uploadSource && uploadDate && fileInputRef.current?.files?.length;

  // ── Integration cards config ──

  const integrations = [
    {
      id: "gist",
      name: "Gist",
      icon: MessageCircle,
      connected: hasGist,
      enabled: true,
    },
    { id: "whatsapp", name: "WhatsApp", icon: Phone, connected: false, enabled: false },
    { id: "discord", name: "Discord", icon: Hash, connected: false, enabled: false },
    { id: "email", name: "Email", icon: Mail, connected: false, enabled: false },
    { id: "transcription", name: "Transcrição", icon: Mic, connected: false, enabled: false },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie integrações globais e uploads de dados
          </p>
        </div>

        <Tabs defaultValue="integrations">
          <TabsList>
            <TabsTrigger value="integrations">Integrações</TabsTrigger>
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
          </TabsList>

          {/* ═══ Tab: Integrações ═══ */}
          <TabsContent value="integrations" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integ) => (
                <Card
                  key={integ.id}
                  className={`border shadow-sm ${!integ.enabled ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                          <integ.icon className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <span className="font-semibold text-sm">{integ.name}</span>
                      </div>
                      <Badge
                        variant={integ.connected ? "default" : "outline"}
                        className="text-xs"
                      >
                        {integ.connected ? "Conectado" : integ.enabled ? "Desconectado" : "Em breve"}
                      </Badge>
                    </div>

                    {/* Gist-specific actions */}
                    {integ.id === "gist" && integ.connected && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={handleImportHistory}
                          disabled={importing}
                        >
                          {importing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Download className="h-3.5 w-3.5 mr-1" />
                          )}
                          Importar Histórico
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setWizardOpen(true)}
                          disabled={wizardOpen}
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Gerenciar Contatos
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled
                            >
                              Configurar Webhook
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Em breve</TooltipContent>
                        </Tooltip>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          disabled
                        >
                          Desconectar
                        </Button>
                      </div>
                    )}

                    {!integ.enabled && (
                      <p className="text-xs text-muted-foreground">Em breve</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Import progress */}
            {importProgress && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-sm space-y-1">
                  {!importProgress.done ? (
                    <>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importando página {importProgress.page}...
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {importProgress.conversations_fetched} conversas |{" "}
                        {importProgress.messages_fetched} mensagens importadas
                      </p>
                    </>
                  ) : importProgress.error ? (
                    <p className="text-destructive">Erro: {importProgress.error}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-primary">
                      <Check className="h-4 w-4" />
                      Importação concluída: {importProgress.conversations_fetched} conversas,{" "}
                      {importProgress.messages_fetched} mensagens
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ Tab: Uploads ═══ */}
          <TabsContent value="uploads" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Upload de Transcrições</CardTitle>
                <CardDescription>
                  Importe arquivos de transcrição de reuniões (.txt, .vtt, .csv)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={uploadClientId} onValueChange={setUploadClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fonte</Label>
                    <Select value={uploadSource} onValueChange={setUploadSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="tactiq">Tactiq</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data da Reunião</Label>
                    <Input
                      type="date"
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Arquivo</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.vtt,.csv"
                    />
                  </div>
                </div>

                <Button onClick={handleUpload} disabled={!canUpload}>
                  <Upload className="h-4 w-4 mr-1" /> Importar Transcrição
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Contact Wizard ── */}
      <GistContactWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        mode="update-contacts"
      />
    </DashboardLayout>
  );
};

export default SettingsPage;
