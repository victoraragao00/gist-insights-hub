import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Users,
  MessageCircle,
  Loader2,
  Building2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GistContactWizard } from "@/components/GistContactWizard";

// ── Types ──────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
}

interface ChannelBinding {
  id: string;
  client_id: string;
  channel: string;
  label: string | null;
  active: boolean | null;
}

interface Participant {
  id: string;
  client_id: string | null;
  name: string;
  role: string | null;
  side: string;
  identifiers: unknown[] | null;
  active: boolean | null;
}

// ── Component ──────────────────────────────────────────

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientSlug, setNewClientSlug] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [newParticipantOpen, setNewParticipantOpen] = useState(false);
  const [npName, setNpName] = useState("");
  const [npRole, setNpRole] = useState("");
  const [npSide, setNpSide] = useState<string>("client");
  const [creatingParticipant, setCreatingParticipant] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(false);

  const [scopeText, setScopeText] = useState("");
  const [savingScope, setSavingScope] = useState(false);

  // ── Queries ──

  const { data: clients = [], isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["clients"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, metadata")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  const { data: bindings = [] } = useQuery<ChannelBinding[]>({
    queryKey: ["channel_bindings", selectedClientId],
    enabled: !!selectedClientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_bindings")
        .select("id, client_id, channel, label, active")
        .eq("client_id", selectedClientId!);
      if (error) throw error;
      return (data ?? []) as ChannelBinding[];
    },
  });

  const hasGistBinding = bindings.some((b) => b.channel === "gist");

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["participants", selectedClientId],
    enabled: !!selectedClientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, client_id, name, role, side, identifiers, active")
        .eq("client_id", selectedClientId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
  });

  // ── Load scope when client changes ──

  const prevScopeClientRef = useRef<string | null>(null);
  if (selectedClient && selectedClient.id !== prevScopeClientRef.current) {
    prevScopeClientRef.current = selectedClient.id;
    const meta = selectedClient.metadata as Record<string, unknown> | null;
    setScopeText(typeof meta?.scope === "string" ? meta.scope : "");
  }

  // ── Create client ──

  const handleCreateClient = async () => {
    if (!newClientName.trim() || !newClientSlug.trim()) {
      toast.error("Preencha nome e slug");
      return;
    }
    setCreatingClient(true);
    try {
      const { error } = await supabase.from("clients").insert({
        name: newClientName.trim(),
        slug: newClientSlug.trim().toLowerCase(),
      });
      if (error) throw error;
      toast.success("Cliente criado!");
      setNewClientOpen(false);
      setNewClientName("");
      setNewClientSlug("");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao criar cliente: " + msg);
    } finally {
      setCreatingClient(false);
    }
  };

  // ── Create participant ──

  const handleCreateParticipant = async () => {
    if (!npName.trim()) {
      toast.error("Preencha o nome");
      return;
    }
    setCreatingParticipant(true);
    try {
      const { error } = await supabase.from("participants").insert({
        name: npName.trim(),
        role: npRole.trim() || null,
        side: npSide,
        client_id: selectedClientId,
      });
      if (error) throw error;
      toast.success("Participante adicionado!");
      setNewParticipantOpen(false);
      setNpName("");
      setNpRole("");
      setNpSide("client");
      queryClient.invalidateQueries({ queryKey: ["participants", selectedClientId] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao adicionar participante: " + msg);
    } finally {
      setCreatingParticipant(false);
    }
  };

  // ── Save scope ──

  const handleSaveScope = async () => {
    if (!selectedClient) return;
    setSavingScope(true);
    try {
      const existingMeta = (selectedClient.metadata as Record<string, unknown>) ?? {};
      const { error } = await supabase
        .from("clients")
        .update({ metadata: { ...existingMeta, scope: scopeText } })
        .eq("id", selectedClient.id);
      if (error) throw error;
      toast.success("Escopo salvo!");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao salvar escopo: " + msg);
    } finally {
      setSavingScope(false);
    }
  };

  // ── Channel icon helper ──

  const channelIcon = (ch: string) => {
    switch (ch) {
      case "gist":
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground">Gerencie clientes, participantes e canais</p>
          </div>
          <Button onClick={() => setNewClientOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Cliente
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* ── Client List ── */}
          <div className="space-y-2">
            {loadingClients && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
              </div>
            )}
            {clients.map((client) => (
              <Card
                key={client.id}
                className={`cursor-pointer border transition-colors ${
                  selectedClientId === client.id
                    ? "border-primary bg-accent/30"
                    : "border-border hover:border-primary/40"
                }`}
                onClick={() => setSelectedClientId(client.id)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={client.active ? "default" : "secondary"} className="text-xs">
                      {client.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loadingClients && clients.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum cliente cadastrado
              </p>
            )}
          </div>

          {/* ── Client Details ── */}
          {selectedClient ? (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">{selectedClient.name}</h2>

              {/* 2a. Canais Vinculados */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Canais Vinculados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bindings.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum canal vinculado.</p>
                  )}
                  {bindings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        {channelIcon(b.channel)}
                        <span className="text-sm font-medium capitalize">{b.channel}</span>
                        {b.label && (
                          <span className="text-xs text-muted-foreground">({b.label})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={b.active ? "default" : "secondary"} className="text-xs">
                          {b.active ? "Ativo" : "Inativo"}
                        </Badge>
                        {b.channel === "gist" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setWizardOpen(true)}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" /> Importar Contatos
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!hasGistBinding && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setWizardOpen(true)}
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Conectar Gist
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* 2b. Participantes */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Participantes</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewParticipantOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </CardHeader>
                <CardContent>
                  {participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum participante vinculado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Papel</TableHead>
                          <TableHead>Lado</TableHead>
                          <TableHead>IDs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participants.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm font-medium">{p.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {p.role ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {p.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {Array.isArray(p.identifiers) ? p.identifiers.length : 0}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* 2c. Escopo e SLA */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Escopo e SLA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Escopo do atendimento</Label>
                    <Textarea
                      rows={4}
                      placeholder="Descreva o escopo de atendimento deste cliente..."
                      value={scopeText}
                      onChange={(e) => setScopeText(e.target.value)}
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveScope} disabled={savingScope}>
                    {savingScope && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Salvar Escopo
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Building2 className="h-5 w-5 mr-2" />
              Selecione um cliente para ver os detalhes
            </div>
          )}
        </div>
      </div>

      {/* ── New Client Dialog ── */}
      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>Preencha os dados do novo cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Nome do cliente"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                placeholder="slug-do-cliente"
                value={newClientSlug}
                onChange={(e) => setNewClientSlug(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClientOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateClient} disabled={creatingClient}>
              {creatingClient && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Participant Dialog ── */}
      <Dialog open={newParticipantOpen} onOpenChange={setNewParticipantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Participante</DialogTitle>
            <DialogDescription>
              Adicionar participante ao cliente {selectedClient?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Nome completo"
                value={npName}
                onChange={(e) => setNpName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Input
                placeholder="Ex: Gerente, Suporte"
                value={npRole}
                onChange={(e) => setNpRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Lado</Label>
              <Select value={npSide} onValueChange={setNpSide}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="umode">uMode (equipe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewParticipantOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateParticipant} disabled={creatingParticipant}>
              {creatingParticipant && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Gist Contact Wizard ── */}
      <GistContactWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          queryClient.invalidateQueries({ queryKey: ["participants", selectedClientId] });
          queryClient.invalidateQueries({ queryKey: ["channel_bindings", selectedClientId] });
        }}
        mode={hasGistBinding ? "update-contacts" : "onboarding"}
        clientId={selectedClientId ?? undefined}
      />
    </DashboardLayout>
  );
};

export default ClientsPage;
