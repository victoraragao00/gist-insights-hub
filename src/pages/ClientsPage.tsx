import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

// ── Types ──

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  channel_bindings: Array<{
    channel: string;
    label: string | null;
    active: boolean | null;
  }>;
}

interface InteractionRow {
  client_id: string;
  tone: string | null;
  occurred_at: string;
}

interface ClientStats {
  total_30d: number;
  dominant_tone: string;
  health_pct: number;
  last_contact: string | null;
}

// ── Helpers ──

const CHANNEL_ICONS: Record<string, string> = {
  gist: "💬",
  whatsapp: "📱",
  email: "📧",
  discord: "🟣",
};

const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-green-100 text-green-700" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-100 text-yellow-700" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-100 text-orange-700" },
  critico: { label: "🔴 Crítico", className: "bg-red-100 text-red-700" },
};

function formatLastContact(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  if (dStr === todayStr) return `Hoje, ${time}`;
  if (dStr === yesterdayStr) return `Ontem, ${time}`;
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${day}, ${time}`;
}

function getHealthColor(pct: number): string {
  if (pct < 20) return "bg-green-500";
  if (pct < 40) return "bg-yellow-500";
  if (pct < 70) return "bg-orange-500";
  return "bg-red-500";
}

function computeStats(interactions: InteractionRow[], clientId: string): ClientStats {
  const clientInteractions = interactions.filter((i) => i.client_id === clientId);
  const total = clientInteractions.length;

  if (total === 0) {
    return { total_30d: 0, dominant_tone: "ok", health_pct: 0, last_contact: null };
  }

  // Dominant tone (most frequent non-ok, fallback to ok)
  const toneCounts: Record<string, number> = {};
  let nonOkCount = 0;
  clientInteractions.forEach((i) => {
    const t = i.tone ?? "ok";
    toneCounts[t] = (toneCounts[t] || 0) + 1;
    if (t !== "ok") nonOkCount++;
  });

  let dominant = "ok";
  let maxCount = 0;
  for (const [tone, count] of Object.entries(toneCounts)) {
    if (tone !== "ok" && count > maxCount) {
      dominant = tone;
      maxCount = count;
    }
  }
  if (maxCount === 0) dominant = "ok";

  const healthPct = Math.round((nonOkCount / total) * 100);
  const lastContact = clientInteractions.reduce((max, i) =>
    i.occurred_at > max ? i.occurred_at : max, clientInteractions[0].occurred_at);

  return { total_30d: total, dominant_tone: dominant, health_pct: healthPct, last_contact: lastContact };
}

// ── Component ──

const ClientsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "total" | "tone" | "health" | "last_contact">("last_contact");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = useCallback((key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }, [sortKey]);

  const thirtyDaysAgo = useMemo(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    []
  );

  const { data: clients = [], isLoading: loadingClients } = useQuery<ClientRow[]>({
    queryKey: ["clients_list", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, channel_bindings(channel, label, active)")
        .eq("active", true)
        .order("name")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: interactions = [] } = useQuery<InteractionRow[]>({
    queryKey: ["interactions_30d_all", user?.id, thirtyDaysAgo],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("client_id, tone, occurred_at")
        .gte("occurred_at", thirtyDaysAgo)
        .limit(200);
      if (error) throw error;
      return (data ?? []) as InteractionRow[];
    },
  });

  const TONE_RANK: Record<string, number> = { ok: 0, atencao: 1, alerta: 2, critico: 3 };

  const clientsWithStats = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = clients
      .map((c) => ({ ...c, stats: computeStats(interactions, c.id) }))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, "pt-BR");
          break;
        case "total":
          cmp = a.stats.total_30d - b.stats.total_30d;
          break;
        case "tone":
          cmp = (TONE_RANK[a.stats.dominant_tone] ?? 0) - (TONE_RANK[b.stats.dominant_tone] ?? 0);
          break;
        case "health":
          cmp = a.stats.health_pct - b.stats.health_pct;
          break;
        case "last_contact":
          cmp = (a.stats.last_contact ?? "").localeCompare(b.stats.last_contact ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, interactions, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie clientes, participantes e canais</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64 h-9"
            />
          </div>
          <Button onClick={() => toast.info("Em breve")}>
            <Plus className="h-4 w-4 mr-1" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        {loadingClients ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </div>
        ) : clientsWithStats.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            Nenhum cliente ativo. Adicione um cliente para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton label="Cliente" col="name" current={sortKey} dir={sortDir} onClick={toggleSort} />
                </TableHead>
                <TableHead>Canais</TableHead>
                <TableHead className="text-right">
                  <SortButton label="Interações (30d)" col="total" current={sortKey} dir={sortDir} onClick={toggleSort} className="justify-end" />
                </TableHead>
                <TableHead>
                  <SortButton label="Tom predominante" col="tone" current={sortKey} dir={sortDir} onClick={toggleSort} />
                </TableHead>
                <TableHead>
                  <SortButton label="Saúde" col="health" current={sortKey} dir={sortDir} onClick={toggleSort} />
                </TableHead>
                <TableHead>
                  <SortButton label="Último contato" col="last_contact" current={sortKey} dir={sortDir} onClick={toggleSort} />
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientsWithStats.map((client) => {
                const tone = TONE_CONFIG[client.stats.dominant_tone] ?? TONE_CONFIG.ok;
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/clients/${client.slug}`)}
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm text-foreground">{client.name}</span>
                        <p className="text-xs text-muted-foreground">{client.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {client.channel_bindings
                          .filter((b) => b.active)
                          .map((b, idx) => (
                            <span key={idx} title={`${b.channel}${b.label ? ` — ${b.label}` : ""}`} className="text-base">
                              {CHANNEL_ICONS[b.channel] ?? "📡"}
                            </span>
                          ))}
                        {client.channel_bindings.filter((b) => b.active).length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {client.stats.total_30d}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs border-0 ${tone.className}`}>
                        {tone.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getHealthColor(client.stats.health_pct)}`}
                            style={{ width: `${Math.min(client.stats.health_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{client.stats.health_pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastContact(client.stats.last_contact)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client.slug}`); }}>
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Em breve"); }}>
                            Importar Contatos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); toast.info("Em breve"); }}
                          >
                            Desativar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default ClientsPage;
