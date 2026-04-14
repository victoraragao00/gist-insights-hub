import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, RotateCcw, Play, Plus, X, History, Sparkles, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";
import { toast } from "sonner";

// ── Types ──

interface PromptConfig {
  id: string;
  version: number;
  name: string;
  system_prompt: string;
  valid_themes: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  notes: string | null;
}

interface TestResult {
  conversation_id: string;
  message_count: number;
  current: { tone: string | null; theme: string | null; sentiment: number | null; model: string | null };
  new: { tone: string | null; theme: string | null; theme_detail: string | null; tone_detail: string | null; sentiment: number | null; is_out_of_scope: boolean };
  changed: boolean;
}

interface TestResponse {
  model_used: string;
  conversations_tested: number;
  results: TestResult[];
}

// ── Tone badge helper ──

function ToneBadge({ tone }: { tone: string | null }) {
  const variants: Record<string, string> = {
    ok: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    atencao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
    alerta: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    critico: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <Badge variant="outline" className={`text-xs ${variants[tone ?? ""] ?? ""}`}>
      {tone ?? "—"}
    </Badge>
  );
}

// ── Main Component ──

export function ClassifierSettingsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { clients } = useClient();

  // ── State ──
  const [editPrompt, setEditPrompt] = useState("");
  const [editThemes, setEditThemes] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Test state
  const [testConvIds, setTestConvIds] = useState("");
  const [testClientId, setTestClientId] = useState("");
  const [testUseActive, setTestUseActive] = useState(true);
  const [testResults, setTestResults] = useState<TestResponse | null>(null);

  // ── Queries ──

  const { data: configs = [], isLoading } = useQuery<PromptConfig[]>({
    queryKey: ["classification_prompt_config", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classification_prompt_config" as never)
        .select("*")
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PromptConfig[];
    },
  });

  const activeConfig = useMemo(() => configs.find(c => c.active), [configs]);

  // Load active into editor on first fetch
  const [initialized, setInitialized] = useState(false);
  if (activeConfig && !initialized) {
    setEditPrompt(activeConfig.system_prompt);
    setEditThemes(activeConfig.valid_themes);
    setEditName(activeConfig.name);
    setEditNotes("");
    setInitialized(true);
  }

  // ── Save mutation ──

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Deactivate current active
      if (activeConfig) {
        await supabase
          .from("classification_prompt_config" as never)
          .update({ active: false } as never)
          .eq("id" as never, activeConfig.id as never);
      }

      const nextVersion = (configs[0]?.version ?? 0) + 1;

      const { error } = await supabase
        .from("classification_prompt_config" as never)
        .insert({
          version: nextVersion,
          name: editName || `Mega Agente v${nextVersion}`,
          system_prompt: editPrompt,
          valid_themes: editThemes,
          active: true,
          created_by: user?.id,
          notes: editNotes || null,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classification_prompt_config"] });
      setIsDirty(false);
      setEditNotes("");
      toast.success("Nova versão do prompt salva e ativada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  // ── Restore mutation ──

  const restoreMutation = useMutation({
    mutationFn: async (configId: string) => {
      if (activeConfig) {
        await supabase
          .from("classification_prompt_config" as never)
          .update({ active: false } as never)
          .eq("id" as never, activeConfig.id as never);
      }
      const { error } = await supabase
        .from("classification_prompt_config" as never)
        .update({ active: true } as never)
        .eq("id" as never, configId as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classification_prompt_config"] });
      setInitialized(false);
      toast.success("Versão restaurada e ativada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao restaurar"),
  });

  // ── Test mutation ──

  const testMutation = useMutation({
    mutationFn: async (): Promise<TestResponse> => {
      let convIds: string[] = [];

      if (testConvIds.trim()) {
        convIds = testConvIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      } else if (testClientId) {
        // Fetch recent conversations for client
        const { data } = await supabase
          .from("interactions")
          .select("conversation_id")
          .eq("client_id", testClientId)
          .not("conversation_id", "is", null)
          .not("classified_at", "is", null)
          .order("occurred_at", { ascending: false })
          .limit(100);

        const unique = [...new Set((data ?? []).map(r => r.conversation_id).filter(Boolean))];
        convIds = unique.slice(0, 10) as string[];
      }

      if (convIds.length === 0) {
        throw new Error("Informe IDs de conversas ou selecione um cliente");
      }

      const payload: Record<string, unknown> = { conversation_ids: convIds };
      if (!testUseActive && isDirty) {
        payload.draft_prompt = editPrompt;
        payload.draft_themes = editThemes;
      }

      const { data, error } = await supabase.functions.invoke("test-classify", {
        body: payload,
      });

      if (error) throw error;
      return data as TestResponse;
    },
    onSuccess: (data) => {
      setTestResults(data);
      const changed = data.results.filter(r => r.changed).length;
      toast.success(`Teste concluído: ${data.conversations_tested} conversas, ${changed} com mudanças`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro no teste"),
  });

  // ── Theme management ──

  const addTheme = () => {
    const slug = newTheme.trim().toLowerCase().replace(/\s+/g, "_");
    if (slug && !editThemes.includes(slug)) {
      setEditThemes(prev => [...prev, slug]);
      setNewTheme("");
      setIsDirty(true);
    }
  };

  const removeTheme = (theme: string) => {
    setEditThemes(prev => prev.filter(t => t !== theme));
    setIsDirty(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 mt-4">
      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor"><Sparkles className="h-3.5 w-3.5 mr-1" />Editor</TabsTrigger>
          <TabsTrigger value="test"><FlaskConical className="h-3.5 w-3.5 mr-1" />Testar</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        {/* ═══ Editor ═══ */}
        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Prompt do Classificador</CardTitle>
                  <CardDescription>
                    Versão ativa: {activeConfig ? `v${activeConfig.version} — ${activeConfig.name}` : "Nenhuma"}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={!isDirty || saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                        Salvar como nova versão
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Salvar nova versão do prompt?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A nova versão será ativada imediatamente. O próximo batch de classificação usará este prompt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2 py-2">
                        <Label>Notas sobre a mudança</Label>
                        <Input
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Ex: Ajustado calibração de tom para atencao"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => saveMutation.mutate()}>
                          Confirmar e ativar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da versão</Label>
                <Input
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setIsDirty(true); }}
                  placeholder="Mega Agente v3"
                />
              </div>

              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={editPrompt}
                  onChange={(e) => { setEditPrompt(e.target.value); setIsDirty(true); }}
                  className="min-h-[400px] font-mono text-xs"
                  placeholder="Cole aqui o prompt completo do classificador..."
                />
                <p className="text-xs text-muted-foreground">{editPrompt.length.toLocaleString()} caracteres</p>
              </div>

              <div className="space-y-2">
                <Label>Temas Válidos ({editThemes.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {editThemes.map((theme) => (
                    <Badge key={theme} variant="secondary" className="text-xs gap-1">
                      {theme}
                      <button onClick={() => removeTheme(theme)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTheme}
                    onChange={(e) => setNewTheme(e.target.value)}
                    placeholder="novo_tema"
                    className="w-48"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTheme())}
                  />
                  <Button variant="outline" size="sm" onClick={addTheme} disabled={!newTheme.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tester ═══ */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sandbox de Teste</CardTitle>
              <CardDescription>
                Teste o classificador em conversas reais sem salvar resultados no banco.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cliente (últimas 10 conversas)</Label>
                  <Select value={testClientId} onValueChange={setTestClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ou cole conversation_ids (1 por linha)</Label>
                  <Textarea
                    value={testConvIds}
                    onChange={(e) => setTestConvIds(e.target.value)}
                    placeholder="conv_abc123&#10;conv_def456"
                    className="min-h-[80px] text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={testUseActive}
                    onChange={() => setTestUseActive(true)}
                  />
                  Usar prompt ativo (v{activeConfig?.version ?? "?"})
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!testUseActive}
                    onChange={() => setTestUseActive(false)}
                    disabled={!isDirty}
                  />
                  Usar rascunho do editor {isDirty ? "" : "(sem mudanças)"}
                </label>
              </div>

              <Button onClick={() => testMutation.mutate()} disabled={testMutation.isPending || (!testConvIds.trim() && !testClientId)}>
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                Executar Teste
              </Button>

              {testResults && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Modelo: {testResults.model_used}</Badge>
                    <Badge variant="outline" className="text-xs">{testResults.conversations_tested} conversas</Badge>
                    <Badge variant="outline" className="text-xs">
                      {testResults.results.filter(r => r.changed).length} alterações
                    </Badge>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversa</TableHead>
                        <TableHead>Msgs</TableHead>
                        <TableHead>Tom Atual</TableHead>
                        <TableHead>Tom Novo</TableHead>
                        <TableHead>Tema Atual</TableHead>
                        <TableHead>Tema Novo</TableHead>
                        <TableHead>Sentimento</TableHead>
                        <TableHead>Mudou?</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testResults.results.map((r) => (
                        <TableRow key={r.conversation_id} className={r.changed ? "bg-yellow-50/50 dark:bg-yellow-950/20" : ""}>
                          <TableCell className="text-xs font-mono max-w-[120px] truncate">{r.conversation_id}</TableCell>
                          <TableCell className="text-xs">{r.message_count}</TableCell>
                          <TableCell><ToneBadge tone={r.current.tone} /></TableCell>
                          <TableCell><ToneBadge tone={r.new.tone as string} /></TableCell>
                          <TableCell className="text-xs">{r.current.theme ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.new.theme ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.current.sentiment?.toFixed(1) ?? "—"} → {(r.new.sentiment as number | null)?.toFixed(1) ?? "—"}
                          </TableCell>
                          <TableCell>
                            {r.changed ? (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">Sim</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Não</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ History ═══ */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Versões</CardTitle>
              <CardDescription>Todas as versões do prompt. Restaure uma versão anterior a qualquer momento.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Versão</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((cfg) => (
                    <TableRow key={cfg.id}>
                      <TableCell className="font-mono text-sm">v{cfg.version}</TableCell>
                      <TableCell className="text-sm">{cfg.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(cfg.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{cfg.notes ?? "—"}</TableCell>
                      <TableCell>
                        {cfg.active ? (
                          <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!cfg.active && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditPrompt(cfg.system_prompt);
                                setEditThemes(cfg.valid_themes);
                                setEditName(cfg.name);
                                setIsDirty(true);
                                toast.info(`Prompt v${cfg.version} carregado no editor`);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreMutation.mutate(cfg.id)}
                              disabled={restoreMutation.isPending}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />Restaurar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
