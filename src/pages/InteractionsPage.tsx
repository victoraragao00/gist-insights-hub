import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";
import { format, subDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare, Smartphone, Mail, Hash, Mic, PenLine,
  X, Search, FilterX, CalendarIcon, ChevronDown, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------- Constants ----------
const PAGE_SIZE = 50;

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  gist: MessageSquare, whatsapp: Smartphone, email: Mail, discord: Hash,
  transcription_gemini: Mic, transcription_tactiq: Mic, manual: PenLine,
};
const CHANNEL_LABELS: Record<string, string> = {
  gist: "Gist", whatsapp: "WhatsApp", email: "Email", discord: "Discord",
  transcription_gemini: "Transcrição", transcription_tactiq: "Transcrição", manual: "Manual",
};
const TONE_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  atencao: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  alerta: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  critico: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
const SIDE_COLORS: Record<string, string> = {
  customer: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  agent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};
const SIDE_LABELS: Record<string, string> = { customer: "Cliente", agent: "uMode" };
const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "custom", label: "Personalizado" },
];

// ---------- Types ----------
interface Interaction {
  id: string;
  content: string | null;
  occurred_at: string;
  channel: string;
  sender_side: string | null;
  sender_raw: string | null;
  tone: string | null;
  tone_detail: string | null;
  theme: string | null;
  theme_detail: string | null;
  sentiment: number | null;
  is_out_of_scope: boolean | null;
  classified_at: string | null;
  classification_model: string | null;
  attachments: any;
  raw_payload: any;
  participants: { id: string; name: string; side: string; role: string | null } | null;
}

// ---------- Helpers ----------
const humanizeTheme = (slug: string) => slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const truncate = (text: string, max: number) => text.length <= max ? text : text.slice(0, max) + "…";
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const sanitizeHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url) || /image/i.test(url);
const getFileName = (a: any) => a.name ?? a.title ?? (typeof a.url === "string" ? a.url.split("/").pop()?.split("?")[0] : "Anexo");
const getAttachmentUrl = (a: any): string | null => a.url ?? (typeof a === "string" ? a : null);

// ---------- Sub-components ----------
const DateSeparator = ({ date }: { date: string }) => (
  <div className="flex items-center gap-3 py-3 px-1">
    <Separator className="flex-1" />
    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
      {format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
    </span>
    <Separator className="flex-1" />
  </div>
);

const InteractionRow = memo(({ item, onClick }: { item: Interaction; onClick: () => void }) => {
  const ChannelIcon = CHANNEL_ICONS[item.channel] ?? MessageSquare;
  const sideKey = item.sender_side === "customer" ? "customer" : item.sender_side === "agent" ? "agent" : null;
  const senderName = item.participants?.name ?? item.sender_raw ?? "Desconhecido";

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer flex items-start gap-3 group"
    >
      <div className="mt-0.5 text-muted-foreground">
        <ChannelIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {sideKey && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", SIDE_COLORS[sideKey])}>
              {SIDE_LABELS[sideKey]}
            </span>
          )}
          <span className="text-sm font-medium truncate">{senderName}</span>
          <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
            {format(parseISO(item.occurred_at), "HH:mm")}
          </span>
        </div>
        {item.content && (
          <p className="text-sm text-muted-foreground leading-relaxed">{truncate(stripHtml(item.content), 200)}</p>
        )}
        {Array.isArray(item.attachments) && item.attachments.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
            📎 {item.attachments.length} anexo{item.attachments.length > 1 ? "s" : ""}
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.classified_at ? (
            <>
              {item.tone && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", TONE_COLORS[item.tone] ?? "bg-muted text-muted-foreground")}>
                  {item.tone}
                </span>
              )}
              {item.theme && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
                  {humanizeTheme(item.theme)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
              Não classificado
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
InteractionRow.displayName = "InteractionRow";

const LoadingSkeleton = () => (
  <div className="space-y-2 px-4">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 py-3">
        <Skeleton className="h-4 w-4 mt-1 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

// ---------- Detail Panel ----------
const DetailPanel = ({ item, onClose }: { item: Interaction; onClose: () => void }) => {
  const ChannelIcon = CHANNEL_ICONS[item.channel] ?? MessageSquare;
  const sideKey = item.sender_side === "customer" ? "customer" : item.sender_side === "agent" ? "agent" : null;
  const senderName = item.participants?.name ?? item.sender_raw ?? "Desconhecido";
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];
  const sentimentPercent = item.sentiment != null ? ((item.sentiment + 1) / 2) * 100 : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{senderName}</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ChannelIcon className="h-3.5 w-3.5" />
          <span>{CHANNEL_LABELS[item.channel] ?? item.channel}</span>
          {sideKey && (
            <span className={cn("px-1.5 py-0.5 rounded font-medium", SIDE_COLORS[sideKey])}>
              {SIDE_LABELS[sideKey]}
            </span>
          )}
          <span className="ml-auto">{format(parseISO(item.occurred_at), "dd/MM/yyyy HH:mm:ss")}</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Full content */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Conteúdo</h4>
            {item.content ? (
              <div
                className="text-sm leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Anexos ({attachments.length})</span>
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((a: any, i: number) => {
                    const url = getAttachmentUrl(a);
                    if (!url) return (
                      <div key={i} className="text-xs bg-muted rounded px-2 py-1 truncate">{JSON.stringify(a)}</div>
                    );
                    if (isImageUrl(url)) return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary/30 transition-shadow">
                        <img src={url} alt={getFileName(a)} className="w-full h-24 object-cover" loading="lazy" />
                        <span className="block text-[10px] text-muted-foreground px-1.5 py-1 truncate">{getFileName(a)}</span>
                      </a>
                    );
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-2 hover:bg-accent transition-colors truncate">
                        📄 <span className="truncate underline">{getFileName(a)}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Classification */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Classificação IA</h4>
            {item.classified_at ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Tom</span>
                  {item.tone && (
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", TONE_COLORS[item.tone])}>
                      {item.tone}
                    </span>
                  )}
                </div>
                {item.tone_detail && <p className="text-xs text-muted-foreground pl-[88px] -mt-1">{item.tone_detail}</p>}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Tema</span>
                  {item.theme ? (
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-muted-foreground">{humanizeTheme(item.theme)}</span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </div>
                {item.theme_detail && <p className="text-xs text-muted-foreground pl-[88px] -mt-1">{item.theme_detail}</p>}

                {sentimentPercent != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">Sentimento</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs">-1</span>
                      <Progress value={sentimentPercent} className="h-2 flex-1" />
                      <span className="text-xs">+1</span>
                      <span className="text-xs font-mono">{item.sentiment!.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">Fora de escopo</span>
                  <Badge variant={item.is_out_of_scope ? "destructive" : "secondary"} className="text-[10px]">
                    {item.is_out_of_scope ? "Sim" : "Não"}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  {item.classification_model && <p>Modelo: {item.classification_model}</p>}
                  <p>Classificado em: {format(parseISO(item.classified_at), "dd/MM/yyyy HH:mm")}</p>
                </div>

                <Button variant="outline" size="sm" className="mt-2" onClick={() => toast.info("Em breve")}>
                  Reclassificar
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Ainda não classificado</p>
                <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
                  Classificar agora
                </Button>
              </div>
            )}
          </section>

          {/* Raw payload */}
          {item.raw_payload && (
            <>
              <Separator />
              <details className="group">
                <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer flex items-center gap-1">
                  Payload original
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <pre className="mt-2 text-[10px] bg-muted p-3 rounded-md overflow-auto max-h-60 whitespace-pre-wrap">
                  {JSON.stringify(item.raw_payload, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// ---------- Main Page ----------
const InteractionsPage = () => {
  const { user } = useAuth();
  const { selectedClient } = useClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<Interaction | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get("busca") ?? "");
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters from URL
  const filters = {
    channel: searchParams.get("canal") ?? "",
    side: searchParams.get("lado") ?? "",
    tone: searchParams.get("tom") ?? "",
    theme: searchParams.get("tema") ?? "",
    period: searchParams.get("periodo") ?? "",
    dateFrom: searchParams.get("de") ?? "",
    dateTo: searchParams.get("ate") ?? "",
    search: searchParams.get("busca") ?? "",
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
    setSearchInput("");
  }, [setSearchParams]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setFilter("busca", searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput, setFilter]);

  // Period → date range
  const effectiveDateFrom = filters.period && filters.period !== "custom"
    ? subDays(new Date(), parseInt(filters.period)).toISOString()
    : filters.dateFrom || undefined;
  const effectiveDateTo = filters.dateTo || undefined;

  // Total count query
  const { data: totalCount } = useQuery({
    queryKey: ["interactions_count", selectedClient?.id, filters],
    enabled: !!selectedClient?.id,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", selectedClient!.id);
      if (filters.channel) q = q.eq("channel", filters.channel as any);
      if (filters.side) q = q.eq("sender_side", filters.side);
      if (filters.tone) q = q.eq("tone", filters.tone as any);
      if (filters.theme) q = q.eq("theme", filters.theme);
      if (filters.search) q = q.ilike("content", `%${filters.search}%`);
      if (effectiveDateFrom) q = q.gte("occurred_at", effectiveDateFrom);
      if (effectiveDateTo) q = q.lte("occurred_at", effectiveDateTo);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Infinite query
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ["interactions_feed", selectedClient?.id, filters],
    enabled: !!selectedClient?.id,
    staleTime: 30_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("interactions")
        .select(`
          id, content, occurred_at, channel, sender_side, sender_raw,
          tone, tone_detail, theme, theme_detail, sentiment,
          is_out_of_scope, classified_at, classification_model,
          attachments, raw_payload,
          participants(id, name, side, role)
        `)
        .eq("client_id", selectedClient!.id)
        .order("occurred_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters.channel) q = q.eq("channel", filters.channel as any);
      if (filters.side) q = q.eq("sender_side", filters.side);
      if (filters.tone) q = q.eq("tone", filters.tone as any);
      if (filters.theme) q = q.eq("theme", filters.theme);
      if (filters.search) q = q.ilike("content", `%${filters.search}%`);
      if (effectiveDateFrom) q = q.gte("occurred_at", effectiveDateFrom);
      if (effectiveDateTo) q = q.lte("occurred_at", effectiveDateTo);

      const { data: rows, error } = await q;
      if (error) throw error;
      return (rows ?? []) as Interaction[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allItems = data?.pages.flat() ?? [];
  const displayedCount = allItems.length;

  // Active filters text
  const activeFilterLabels: string[] = [];
  if (filters.channel) activeFilterLabels.push(`canal: ${filters.channel}`);
  if (filters.side) activeFilterLabels.push(`lado: ${filters.side}`);
  if (filters.tone) activeFilterLabels.push(`tom: ${filters.tone}`);
  if (filters.theme) activeFilterLabels.push(`tema: ${filters.theme}`);
  if (filters.search) activeFilterLabels.push(`busca: "${filters.search}"`);
  if (filters.period) activeFilterLabels.push(`período: ${filters.period}d`);

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all", selectedItem && "xl:mr-[420px]")}>
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">Interações</h1>
          <p className="text-muted-foreground text-sm">
            Feed unificado — {selectedClient?.name ?? "..."}
          </p>
        </div>

        {/* Filter Bar */}
        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
          <Select value={filters.channel} onValueChange={(v) => setFilter("canal", v === "all" ? "" : v)}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.side} onValueChange={(v) => setFilter("lado", v === "all" ? "" : v)}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Lado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="customer">Cliente</SelectItem>
              <SelectItem value="agent">uMode</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.tone} onValueChange={(v) => setFilter("tom", v === "all" ? "" : v)}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Tom" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ok">Ok</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="alerta">Alerta</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.period} onValueChange={(v) => setFilter("periodo", v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              {PERIOD_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {filters.period === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {filters.dateFrom ? format(parseISO(filters.dateFrom), "dd/MM") : "De"} — {filters.dateTo ? format(parseISO(filters.dateTo), "dd/MM") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: filters.dateFrom ? parseISO(filters.dateFrom) : undefined,
                    to: filters.dateTo ? parseISO(filters.dateTo) : undefined,
                  } as any}
                  onSelect={(range: any) => {
                    setFilter("de", range?.from ? range.from.toISOString() : "");
                    setFilter("ate", range?.to ? range.to.toISOString() : "");
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nas mensagens..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-8 text-xs pl-7 w-[200px]"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
              <FilterX className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Result count */}
        {totalCount != null && totalCount > 0 && (
          <div className="px-4 pb-2 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
            <span>Exibindo {displayedCount} de {totalCount.toLocaleString("pt-BR")} interações</span>
            {activeFilterLabels.length > 0 && (
              <span className="ml-1">[{activeFilterLabels.join(" · ")}]</span>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <LoadingSkeleton />
          ) : allItems.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground space-y-3">
              <MessageSquare className="h-10 w-10 mx-auto opacity-40" />
              <p className="text-sm">Nenhuma interação encontrada{hasActiveFilters ? " para os filtros selecionados." : "."}</p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
              )}
            </div>
          ) : (
            <div>
              {allItems.map((item, idx) => {
                const prev = idx > 0 ? allItems[idx - 1] : null;
                const showDate = !prev || !isSameDay(parseISO(item.occurred_at), parseISO(prev.occurred_at));
                return (
                  <div key={item.id}>
                    {showDate && <DateSeparator date={item.occurred_at} />}
                    <InteractionRow item={item} onClick={() => setSelectedItem(item)} />
                  </div>
                );
              })}
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel — desktop: fixed right, mobile: sheet overlay */}
      {selectedItem && (
        <>
          {/* Desktop panel */}
          <div className="hidden xl:block fixed top-0 right-0 h-screen w-[420px] border-l border-border bg-background z-30">
            <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
          </div>
          {/* Mobile/tablet sheet */}
          <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
            <SheetContent side="right" className="w-[420px] max-w-full p-0 xl:hidden">
              <SheetHeader className="sr-only"><SheetTitle>Detalhe</SheetTitle></SheetHeader>
              <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
};

export default InteractionsPage;
