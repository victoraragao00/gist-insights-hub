import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowRight, ArrowLeft, Check, Users, Building2, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────

type WizardMode = "onboarding" | "update-contacts";
type GroupMappingType = "existing" | "new" | "ignore";
type WizardStep = "clients" | "contacts" | "confirmation" | "import";

interface GistContact {
  id: number;
  name: string;
  email: string;
  company?: string;
}

interface GistTeammate {
  id: number;
  name: string;
  email: string;
}

interface ContactGroup {
  domain: string;
  company?: string;
  grouped_by?: "company_name" | "domain";
  contacts: GistContact[];
  suggested_client_id?: string;
  suggested_client_name?: string;
}

interface DiscoveryPayload {
  contact_groups: ContactGroup[];
  teammates: GistTeammate[];
  total_contacts: number;
  total_teammates: number;
  contacts_without_company?: number;
}

interface GroupMapping {
  domain: string;
  type: GroupMappingType;
  existing_client_id?: string;
  new_client_name?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface GistContactWizardProps {
  open: boolean;
  onClose: () => void;
  mode: WizardMode;
  clientId?: string;
}

// ── Component ──────────────────────────────────────────

export function GistContactWizard({ open, onClose, mode, clientId }: GistContactWizardProps) {
  const [step, setStep] = useState<WizardStep>("clients");
  const [loading, setLoading] = useState(false);
  const [discoveryData, setDiscoveryData] = useState<DiscoveryPayload | null>(null);
  const [groupMappings, setGroupMappings] = useState<Map<string, GroupMapping>>(new Map());
  const [selectedContacts, setSelectedContacts] = useState<Map<number, boolean>>(new Map());
  const [selectedTeammates, setSelectedTeammates] = useState<Map<number, boolean>>(new Map());
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  // saving handled by saveMutation below

  // ── Load clients list ──
  useEffect(() => {
    if (!open) return;
    const loadClients = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .in("status", ["ativo", "trial"])
        .order("name")
        .limit(100);
      if (error) {
        toast.error("Erro ao carregar clientes: " + error.message);
        return;
      }
      setClients((data ?? []).map((c) => ({ id: c.id, name: c.name })));
    };
    loadClients();
  }, [open]);

  // ── Discovery on mount ──
  useEffect(() => {
    if (!open) return;
    setStep("clients");
    setDiscoveryData(null);
    setGroupMappings(new Map());
    setSelectedContacts(new Map());
    setSelectedTeammates(new Map());
    setConfirmed(false);
    runDiscovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runDiscovery = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<DiscoveryPayload>("gist-discover");
      if (error) throw new Error(typeof error === "string" ? error : "Erro na descoberta");
      if (!data) throw new Error("Resposta vazia da descoberta");

      setDiscoveryData(data);

      // ── Smart defaults: ignore all except those with a suggested match ──
      const mappings = new Map<string, GroupMapping>();
      for (const group of data.contact_groups) {
        if (group.suggested_client_id) {
          mappings.set(group.domain, {
            domain: group.domain,
            type: "existing",
            existing_client_id: group.suggested_client_id,
          });
        } else {
          mappings.set(group.domain, {
            domain: group.domain,
            type: "ignore",
          });
        }
      }
      setGroupMappings(mappings);

      // Default: select all contacts for non-ignored groups
      const contactSel = new Map<number, boolean>();
      for (const group of data.contact_groups) {
        const mapping = mappings.get(group.domain);
        for (const c of group.contacts) {
          contactSel.set(c.id, mapping?.type !== "ignore");
        }
      }
      setSelectedContacts(contactSel);

      // Default: select all teammates
      const teamSel = new Map<number, boolean>();
      for (const t of data.teammates) {
        teamSel.set(t.id, true);
      }
      setSelectedTeammates(teamSel);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Falha na descoberta de contatos: " + message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // ── Mapping helpers ──

  const updateMapping = useCallback(
    (domain: string, updates: Partial<GroupMapping>) => {
      setGroupMappings((prev) => {
        const next = new Map(prev);
        const current = next.get(domain) ?? { domain, type: "ignore" as GroupMappingType };
        next.set(domain, { ...current, ...updates });

        // Update contact selections when toggling ignore
        if (updates.type !== undefined) {
          setSelectedContacts((cPrev) => {
            const cNext = new Map(cPrev);
            const group = discoveryData?.contact_groups.find((g) => g.domain === domain);
            if (group) {
              for (const c of group.contacts) {
                cNext.set(c.id, updates.type !== "ignore");
              }
            }
            return cNext;
          });
        }

        return next;
      });
    },
    [discoveryData],
  );

  const toggleContact = (id: number) => {
    setSelectedContacts((prev) => {
      const next = new Map(prev);
      next.set(id, !prev.get(id));
      return next;
    });
  };

  const handleBulkAction = useCallback(
    (action: string) => {
      if (!discoveryData) return;
      for (const group of discoveryData.contact_groups) {
        if (action === "ignore") {
          updateMapping(group.domain, { type: "ignore" });
        } else if (action === "existing") {
          if (group.suggested_client_id) {
            updateMapping(group.domain, {
              type: "existing",
              existing_client_id: group.suggested_client_id,
            });
          } else {
            updateMapping(group.domain, { type: "ignore" });
          }
        } else if (action === "new") {
          updateMapping(group.domain, {
            type: "new",
            new_client_name: group.company ?? group.domain,
          });
        }
      }
    },
    [discoveryData, updateMapping],
  );

  const toggleAllGroupContacts = (domain: string, checked: boolean) => {
    const group = discoveryData?.contact_groups.find((g) => g.domain === domain);
    if (!group) return;
    setSelectedContacts((prev) => {
      const next = new Map(prev);
      for (const c of group.contacts) {
        next.set(c.id, checked);
      }
      return next;
    });
  };

  const toggleTeammate = (id: number) => {
    setSelectedTeammates((prev) => {
      const next = new Map(prev);
      next.set(id, !prev.get(id));
      return next;
    });
  };

  const toggleAllTeammates = (checked: boolean) => {
    setSelectedTeammates((prev) => {
      const next = new Map(prev);
      for (const [id] of prev) {
        next.set(id, checked);
      }
      return next;
    });
  };

  // ── Derived data ──

  const activeGroups =
    discoveryData?.contact_groups.filter(
      (g) => groupMappings.get(g.domain)?.type !== "ignore",
    ) ?? [];

  const ignoredCount =
    (discoveryData?.contact_groups.length ?? 0) - activeGroups.length;

  const newClientCount = activeGroups.filter(
    (g) => groupMappings.get(g.domain)?.type === "new",
  ).length;

  const vinculadoCount = activeGroups.filter(
    (g) => groupMappings.get(g.domain)?.type === "existing",
  ).length;

  const selectedContactCount = activeGroups.reduce((acc, g) => {
    return (
      acc + g.contacts.filter((c) => selectedContacts.get(c.id)).length
    );
  }, 0);

  const selectedTeammateCount = Array.from(selectedTeammates.values()).filter(Boolean).length;

  // ── Confirm / Save ──

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!discoveryData) throw new Error("Sem dados de descoberta");

      const mappings = activeGroups.flatMap((group) => {
        const m = groupMappings.get(group.domain);
        if (!m) return [];
        return group.contacts
          .filter((c) => selectedContacts.get(c.id))
          .map((contact) => ({
            contact_id: contact.id,
            contact_name: contact.name,
            contact_email: contact.email,
            mapping_type: m.type,
            existing_client_id: m.type === "existing" ? m.existing_client_id : undefined,
            new_client_name: m.type === "new" ? m.new_client_name : undefined,
            domain: group.domain,
          }));
      });

      const teammates = discoveryData.teammates
        .filter((t) => selectedTeammates.get(t.id))
        .map((t) => ({
          teammate_id: t.id,
          name: t.name,
          email: t.email,
        }));

      const { data, error } = await supabase.functions.invoke("gist-confirm-mapping", {
        body: { mappings, teammates },
      });

      if (error) throw new Error(typeof error === "string" ? error : "Erro ao salvar vínculos");
      return data as { participants_created: number; clients_created: number } | null;
    },
    onSuccess: (result) => {
      if (mode === "update-contacts") {
        toast.success(
          `✓ Vínculos atualizados. ${result?.participants_created ?? 0} participantes cadastrados, ${result?.clients_created ?? 0} clientes criados.`,
        );
        onClose();
      } else {
        setStep("import");
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Falha ao salvar vínculos: " + message);
    },
  });

  // ── Can advance? ──

  const canAdvanceFromClients = activeGroups.length > 0;

  // ── Step indicator ──

  const steps: { key: WizardStep; label: string }[] = [
    { key: "clients", label: "Clientes" },
    { key: "contacts", label: "Contatos" },
    { key: "confirmation", label: "Confirmação" },
    ...(mode === "onboarding" ? [{ key: "import" as WizardStep, label: "Importação" }] : []),
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  // ── Render ──

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === "onboarding" ? "Conectar Gist" : "Atualizar Contatos do Gist"}
          </DialogTitle>
          <DialogDescription>
            {mode === "onboarding"
              ? "Configure os vínculos entre contatos do Gist e clientes do hub."
              : "Revise os vínculos entre contatos do Gist e clientes do hub."}
          </DialogDescription>
          {/* Step indicator */}
          <div className="flex gap-2 pt-2">
            {steps.map((s, i) => (
              <Badge
                key={s.key}
                variant={i === stepIndex ? "default" : i < stepIndex ? "secondary" : "outline"}
                className="text-xs"
              >
                {i + 1}. {s.label}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Consultando contatos no Gist...
            </div>
          )}

          {/* ═══ STEP 1: Clients ═══ */}
          {!loading && step === "clients" && discoveryData && (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
                <span className="text-sm text-muted-foreground">
                  {discoveryData.contact_groups.length} domínios encontrados
                </span>
                <Select onValueChange={handleBulkAction}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder="Aplicar a todos..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignore">Ignorar todos</SelectItem>
                    <SelectItem value="existing">Vincular todos (com match)</SelectItem>
                    <SelectItem value="new">Criar todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                {discoveryData.contact_groups.map((group) => {
                  const mapping = groupMappings.get(group.domain);
                  const mappingType = mapping?.type ?? "ignore";

                  return (
                    <div
                      key={group.domain}
                      className={`rounded-lg border p-4 space-y-3 transition-colors ${
                        mappingType === "ignore"
                          ? "bg-muted/40 border-border/50"
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium text-sm truncate">
                              {group.domain}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.contacts.length} contatos
                            {group.company ? ` · ${group.company}` : ""}
                          </p>
                        </div>

                        <Select
                          value={mappingType}
                          onValueChange={(val: string) => {
                            const type = val as GroupMappingType;
                            updateMapping(group.domain, {
                              type,
                              existing_client_id:
                                type === "existing"
                                  ? group.suggested_client_id ?? undefined
                                  : undefined,
                              new_client_name: undefined,
                            });
                          }}
                        >
                          <SelectTrigger className="w-[220px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">
                              <span className="flex items-center gap-2">
                                <Ban className="h-3.5 w-3.5" /> Ignorar
                              </span>
                            </SelectItem>
                            <SelectItem value="existing">
                              <span className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5" /> Vincular a cliente existente
                              </span>
                            </SelectItem>
                            <SelectItem value="new">
                              <span className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" /> Criar novo cliente
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Client selector for "existing" */}
                      {mappingType === "existing" && (
                        <Select
                          value={mapping?.existing_client_id ?? ""}
                          onValueChange={(val) =>
                            updateMapping(group.domain, { existing_client_id: val })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o cliente..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Name input for "new" */}
                      {mappingType === "new" && (
                        <Input
                          placeholder="Nome do novo cliente"
                          value={mapping?.new_client_name ?? ""}
                          onChange={(e) =>
                            updateMapping(group.domain, { new_client_name: e.target.value })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-muted-foreground border-t pt-3 flex flex-wrap gap-3">
                <span>{vinculadoCount} para vincular</span>
                <span>{newClientCount} para criar</span>
                <span>{ignoredCount} ignorados</span>
              </div>
            </>
          )}

          {/* ═══ STEP 2: Contacts ═══ */}
          {step === "contacts" && discoveryData && (
            <>
              {activeGroups.map((group) => {
                const mapping = groupMappings.get(group.domain);
                const allChecked = group.contacts.every((c) => selectedContacts.get(c.id));
                const label =
                  mapping?.type === "existing"
                    ? clients.find((c) => c.id === mapping.existing_client_id)?.name ?? group.domain
                    : mapping?.new_client_name ?? group.domain;

                return (
                  <div key={group.domain} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {group.domain}
                        <Badge variant="outline" className="text-xs font-normal">
                          → {label}
                        </Badge>
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => toggleAllGroupContacts(group.domain, !allChecked)}
                      >
                        {allChecked ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.contacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedContacts.get(contact.id) ?? false}
                                onCheckedChange={() => toggleContact(contact.id)}
                              />
                            </TableCell>
                            <TableCell className="text-sm">{contact.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {contact.email}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}

              {/* Teammates */}
              {discoveryData.teammates.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Teammates (equipe uMode)
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const allChecked = discoveryData.teammates.every(
                          (t) => selectedTeammates.get(t.id),
                        );
                        toggleAllTeammates(!allChecked);
                      }}
                    >
                      {discoveryData.teammates.every((t) => selectedTeammates.get(t.id))
                        ? "Desmarcar todos"
                        : "Selecionar todos"}
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discoveryData.teammates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTeammates.get(t.id) ?? false}
                              onCheckedChange={() => toggleTeammate(t.id)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{t.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="text-xs text-muted-foreground border-t pt-3">
                {selectedContactCount} contatos e {selectedTeammateCount} teammates selecionados
              </div>
            </>
          )}

          {/* ═══ STEP 3: Confirmation ═══ */}
          {step === "confirmation" && discoveryData && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
                <p>
                  <strong>{selectedContactCount}</strong> participantes serão cadastrados como
                  contatos de clientes
                </p>
                <p>
                  <strong>{selectedTeammateCount}</strong> teammates serão cadastrados como equipe
                  uMode
                </p>
                {newClientCount > 0 && (
                  <p>
                    <strong>{newClientCount}</strong> novos clientes serão criados:{" "}
                    {activeGroups
                      .filter((g) => groupMappings.get(g.domain)?.type === "new")
                      .map((g) => groupMappings.get(g.domain)?.new_client_name)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {ignoredCount} domínios ignorados
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                Entendi. Confirmar e prosseguir.
              </label>
            </div>
          )}

          {/* ═══ STEP 4: Import (onboarding only) ═══ */}
          {step === "import" && (
            <div className="space-y-4 py-6 text-center">
              <Check className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm">
                Vínculos salvos com sucesso! O histórico completo de conversas pode ser importado
                em <strong>Configurações → Integrações</strong>.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "clients" && !loading && (
            <Button
              onClick={() => setStep("contacts")}
              disabled={!canAdvanceFromClients}
            >
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === "contacts" && (
            <>
              <Button variant="outline" onClick={() => setStep("clients")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep("confirmation")}
                disabled={selectedContactCount === 0 && selectedTeammateCount === 0}
              >
                Confirmar Vínculos <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "confirmation" && (
            <>
              <Button variant="outline" onClick={() => setStep("contacts")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!confirmed || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Vínculos <Check className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === "import" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  window.location.href = "/settings";
                }}
              >
                Ir para Configurações
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
