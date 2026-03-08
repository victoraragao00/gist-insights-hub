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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, ArrowUp, ArrowDown, ArrowUpDown, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePriorityScores } from "@/hooks/usePriorityScores";

// ── Types ──

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  trial: { label: "Trial", className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
  inativo: { label: "Inativo", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  status: string;
  channel_bindings: Array<{
    channel: string;
    label: string | null;
    active: boolean | null;
  }>;
}

interface ClientStats {
  total_30d: number;
  dominant_tone: string;
  health_pct: number;
  last_contact: string | null;
}

interface ClientStatsRow {
  client_id: string;
  total_30d: number;
  dominant_tone: string;
  health_pct: number;
  last_contact: string | null;
}

// ── Pagination ──
const PAGE_SIZE = 50;

// ── Helpers ──

const CHANNEL_ICONS: Record<string, string> = {
  gist: "💬",
  whatsapp: "📱",
  email: "📧",
  discord: "🟣",
};

const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  critico: { label: "🔴 Crítico", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
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
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-yellow-500";
  if (pct >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function scoreColorClass(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (score >= 60) return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
}

// ── Sort Button ──

type SortCol = "name" | "total" | "tone" | "health" | "score" | "last_contact";

function SortButton({ label, col, current, dir, onClick, className = "" }: {
  label: string; col: SortCol; current: SortCol; dir: "asc" | "desc"; onClick: (col: SortCol) => void; className?: string;
}) {
  const active = current === col;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const sortDesc = active ? (dir === "asc" ? " (ascendente)" : " (descendente)") : "";
  return (
    <button
      type="button"
      aria-label={`Ordenar por ${label}${sortDesc}`}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded ${className}`}
      onClick={(e) => { e.stopPropagation(); onClick(col); }}
    >
      {label}
      <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );
}

// ── Component ──

const ClientsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortCol>("last_contact");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: scores } = usePriorityScores();
  const scoreMap = useMemo(() => {
    const m = new Map<string, number>();
    (scores ?? []).forEach((r) => m.set(r.client_id, r.score));
    return m;
  }, [scores]);

  const toggleSort = useCallback((key: SortCol) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }, [sortKey]);

  const { data: clientsData, isLoading: loadingClients, isError: clientsError, refetch: refetchClients } = useQuery<{ list: ClientRow[]; totalCount: number }>({
    queryKey: ["clients_list", user?.id, page, includeInactive],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = (page + 1) * PAGE_SIZE - 1;
      let query = supabase
        .from("clients")
        .select("id, name, slug, active, status, channel_bindings(channel, label, active)", { count: "exact" });
      if (!includeInactive) {
        query = query.in("status", ["ativo", "trial"]);
      }
      const { data, error, count } = await query.order("name").range(from, to);
      if (error) throw error;
      return { list: (data ?? []) as ClientRow[], totalCount: count ?? 0 };
    },
  });

  const clients = clientsData?.list ?? [];
  const totalCount = clientsData?.totalCount ?? 0;

  const { data: statsMap = {} } = useQuery<Record<string, ClientStats>>({
    queryKey: ["client_stats_30d", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("client_stats_30d", { _user_id: user!.id });
      if (error) throw error;
      const map: Record<string, ClientStats> = {};
      (data as ClientStatsRow[] ?? []).forEach((r) => {
        map[r.client_id] = {
          total_30d: Number(r.total_30d),
          dominant_tone: r.dominant_tone,
          health_pct: r.health_pct,
          last_contact: r.last_contact,
        };
      });
      return map;
    },
  });

  const DEFAULT_STATS: ClientStats = { total_30d: 0, dominant_tone: "ok", health_pct: 0, last_contact: null };
  const TONE_RANK: Record<string, number> = { ok: 0, atencao: 1, alerta: 2, critico: 3 };

  const clientsWithStats = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = clients
      .map((c) => ({ ...c, stats: statsMap[c.id] ?? DEFAULT_STATS }))
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
        case "score": {
          const sa = scoreMap.get(a.id) ?? null;
          const sb = scoreMap.get(b.id) ?? null;
          if (sa === null && sb === null) cmp = 0;
          else if (sa === null) cmp = 1;
          else if (sb === null) cmp = -1;
          else cmp = sa - sb;
          break;
        }
        case "last_contact":
          cmp = (a.stats.last_contact ?? "").localeCompare(b.stats.last_contact ?? "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, statsMap, scoreMap, search, sortKey, sortDir]);

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
        </div>
      </div>

      {clientsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar clientes</AlertTitle>
          <AlertDescription>
            Não foi possível carregar a lista. Tente novamente.
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchClients()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        {!clientsError && loadingClients ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-40 animate-shimmer" />
                <Skeleton className="h-5 w-20 animate-shimmer" />
                <Skeleton className="h-5 w-16 animate-shimmer" />
                <Skeleton className="h-5 w-20 animate-shimmer" />
                <Skeleton className="h-2 w-16 animate-shimmer" />
                <Skeleton className="h-7 w-12 animate-shimmer" />
                <Skeleton className="h-5 w-28 animate-shimmer" />
              </div>
            ))}
          </div>
        ) : !clientsError && clientsWithStats.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            Nenhum cliente encontrado. {includeInactive ? "Adicione um cliente para começar." : "Ative \"Incluir inativos\" para ver todos."}
          </div>
        ) : (
          <>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
            <span className="text-sm text-muted-foreground">Incluir inativos</span>
          </div>
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
                  <SortButton label="Score" col="score" current={sortKey} dir={sortDir} onClick={toggleSort} />
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
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/30 transition-transform active:scale-[0.995] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    onClick={() => navigate(`/clients/${client.slug}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/clients/${client.slug}`);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="font-medium text-sm text-foreground">{client.name}</span>
                          <p className="text-xs text-muted-foreground">{client.slug}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_CONFIG[client.status]?.className ?? ""}`}>
                          {STATUS_CONFIG[client.status]?.label ?? client.status}
                        </span>
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
                    <TableCell>
                      {(() => {
                        const score = scoreMap.get(client.id);
                        return score != null ? (
                          <span className={`inline-flex items-center justify-center h-7 w-12 rounded text-xs font-bold tabular-nums ${scoreColorClass(score)}`}>
                            {Math.min(score, 100)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastContact(client.stats.last_contact)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Abrir menu de ações do cliente">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/clients/${client.slug}`); }}>
                            Ver detalhes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </>
        )}
        {!clientsError && !loadingClients && clientsWithStats.length > 0 && totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Página {page + 1} de {Math.ceil(totalCount / PAGE_SIZE) || 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientsPage;
