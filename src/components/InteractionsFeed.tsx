import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Search, MessageSquare, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ---------- Types ----------
interface Interaction {
  id: string;
  content: string | null;
  occurred_at: string;
  sender_raw: string | null;
  sender_side: string | null;
  tone: string | null;
  theme: string | null;
  classified_at: string | null;
  raw_payload: any;
  attachments: any;
}

interface Conversation {
  conversationId: string;
  messages: Interaction[];
  lastMessage: Interaction;
  worstTone: "ok" | "atencao" | "alerta" | "critico";
  primaryTheme: string | null;
  hasUnclassified: boolean;
  contactName: string;
  messageCount: number;
}

// ---------- Constants ----------
const TONE_RANK: Record<string, number> = { ok: 0, atencao: 1, alerta: 2, critico: 3 };
const TONE_LABELS: Record<string, string> = { ok: "Ok", atencao: "Atenção", alerta: "Alerta", critico: "Crítico" };
const TONE_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  atencao: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  alerta: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  critico: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};
const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
];
const AVATAR_COLORS = [
  "bg-primary text-primary-foreground",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-sky-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
  "bg-fuchsia-600 text-white",
];

// ---------- Helpers ----------
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const truncate = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max) + "…");
const humanizeTheme = (slug: string) => slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sanitizeHtml = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

function extractContactName(senderRaw: string | null): string {
  if (!senderRaw) return "Desconhecido";
  if (!senderRaw.includes("@")) return senderRaw;
  return senderRaw
    .split("@")[0]
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
  }
  if (diffHours < 48) return "ontem";
  return format(date, "dd MMM", { locale: ptBR });
}

function isInbound(interaction: Interaction): boolean {
  return interaction.raw_payload?.is_inbound === true;
}

function isBotSender(interaction: Interaction): boolean {
  const sender = interaction.sender_raw ?? "";
  return /bot/i.test(sender);
}

// ---------- Build Conversations ----------
function buildConversations(interactions: Interaction[]): Conversation[] {
  const groups = new Map<string, Interaction[]>();

  for (const item of interactions) {
    const convId = item.raw_payload?.conversation_id?.toString();
    if (!convId) continue;
    if (!groups.has(convId)) groups.set(convId, []);
    groups.get(convId)!.push(item);
  }

  const conversations: Conversation[] = [];

  for (const [conversationId, messages] of groups) {
    // messages are already ordered ASC by occurred_at from the query
    const lastMessage = messages[messages.length - 1];

    const worstTone = messages.reduce<"ok" | "atencao" | "alerta" | "critico">((worst, msg) => {
      const t = (msg.tone ?? "ok") as string;
      return (TONE_RANK[t] ?? 0) > (TONE_RANK[worst] ?? 0) ? (t as any) : worst;
    }, "ok");

    const themeMsg = [...messages].reverse().find((m) => m.theme != null);
    const primaryTheme = themeMsg?.theme ?? null;

    const hasUnclassified = messages.some((m) => m.classified_at == null);

    const clientMsg = messages.find(
      (m) => m.sender_side === "client" || m.raw_payload?.is_inbound === true
    );
    const contactName = extractContactName(clientMsg?.sender_raw ?? null);

    conversations.push({
      conversationId,
      messages,
      lastMessage,
      worstTone,
      primaryTheme,
      hasUnclassified,
      contactName,
      messageCount: messages.length,
    });
  }

  // Sort by last message DESC
  conversations.sort(
    (a, b) =>
      new Date(b.lastMessage.occurred_at).getTime() - new Date(a.lastMessage.occurred_at).getTime()
  );

  return conversations;
}

// ---------- Sub-components ----------

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = getInitials(name);
  const colorIdx = hashCode(name) % AVATAR_COLORS.length;
  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-semibold shrink-0", AVATAR_COLORS[colorIdx])}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

function ConversationRow({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const preview = conversation.lastMessage.content
    ? truncate(stripHtml(conversation.lastMessage.content), 80)
    : "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 transition-colors cursor-pointer flex items-start gap-3 border-b border-border",
        isSelected ? "bg-accent/60" : "hover:bg-accent/30"
      )}
    >
      <Avatar name={conversation.contactName} size={40} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{conversation.contactName}</span>
          {conversation.hasUnclassified && (
            <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />
          )}
          <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
            {formatRelativeDate(conversation.lastMessage.occurred_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-snug truncate">{preview}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {conversation.worstTone !== "ok" && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", TONE_COLORS[conversation.worstTone])}>
              {TONE_LABELS[conversation.worstTone]}
            </span>
          )}
          {conversation.primaryTheme && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
              {humanizeTheme(conversation.primaryTheme)}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {conversation.messageCount} msg{conversation.messageCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ interaction }: { interaction: Interaction }) {
  const inbound = isInbound(interaction);
  const bot = !inbound && isBotSender(interaction);
  const senderName = inbound
    ? extractContactName(interaction.sender_raw)
    : bot
    ? "Bot"
    : "uMode";

  // Bubble styles
  let bubbleBg: string;
  let bubbleText: string;
  let borderRadius: string;

  if (inbound) {
    // Client — left
    bubbleBg = "bg-card";
    bubbleText = "text-card-foreground";
    borderRadius = "rounded-xl rounded-bl-sm";
  } else if (bot) {
    // Bot — right
    bubbleBg = "bg-accent";
    bubbleText = "text-accent-foreground";
    borderRadius = "rounded-xl rounded-br-sm";
  } else {
    // uMode/agent — right
    bubbleBg = "bg-[hsl(263,70%,58%)]";
    bubbleText = "text-white";
    borderRadius = "rounded-xl rounded-br-sm";
  }

  const align = inbound ? "items-start" : "items-end";

  return (
    <div className={cn("flex flex-col gap-1", align)}>
      <div className={cn("flex items-end gap-2", inbound ? "flex-row" : "flex-row-reverse")}>
        <Avatar name={senderName} size={26} />
        <div className={cn("max-w-[75%] px-3 py-2 border border-border", bubbleBg, bubbleText, borderRadius)}>
          {interaction.content ? (
            <div
              className="text-sm leading-relaxed prose prose-sm max-w-none [&_a]:underline break-words"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(interaction.content) }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
          {interaction.tone && interaction.tone !== "ok" && (
            <span className={cn("inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium", TONE_COLORS[interaction.tone])}>
              {TONE_LABELS[interaction.tone]}
            </span>
          )}
        </div>
      </div>
      <span className={cn("text-[10px] text-muted-foreground", inbound ? "pl-9" : "pr-9")}>
        {format(parseISO(interaction.occurred_at), "HH:mm")}
      </span>
    </div>
  );
}

function ThreadPanel({
  conversation,
  onClose,
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const firstDate = conversation.messages[0]?.occurred_at;
  const lastDate = conversation.lastMessage.occurred_at;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={conversation.contactName} size={32} />
            <span className="font-semibold text-sm truncate">{conversation.contactName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span>{conversation.messageCount} mensagens</span>
          <span>·</span>
          <span>
            {firstDate && format(parseISO(firstDate), "dd MMM", { locale: ptBR })}
            {" — "}
            {format(parseISO(lastDate), "dd MMM", { locale: ptBR })}
          </span>
          {conversation.primaryTheme && (
            <>
              <span>·</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {humanizeTheme(conversation.primaryTheme)}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {conversation.messages.map((msg) => (
            <MessageBubble key={msg.id} interaction={msg} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Main Component ----------
export const InteractionsFeed = ({ clientId }: { clientId: string }) => {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [toneFilter, setToneFilter] = useState<string>("all");
  const [period, setPeriod] = useState("30");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const dateFrom = subDays(new Date(), Math.min(parseInt(period), 30)).toISOString();

  // Single query — all interactions for period
  const { data: rawInteractions, isLoading } = useQuery({
    queryKey: ["conversations", clientId, period],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("id, content, occurred_at, sender_raw, sender_side, tone, theme, classified_at, raw_payload, attachments")
        .eq("client_id", clientId)
        .gte("occurred_at", dateFrom)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Interaction[];
    },
  });

  // Build & filter conversations
  const allConversations = useMemo(
    () => buildConversations(rawInteractions ?? []),
    [rawInteractions]
  );

  const filteredConversations = useMemo(() => {
    let convs = allConversations;

    if (toneFilter && toneFilter !== "all") {
      convs = convs.filter((c) => c.worstTone === toneFilter);
    }

    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      convs = convs.filter((c) =>
        c.messages.some((m) => m.content?.toLowerCase().includes(lower)) ||
        c.contactName.toLowerCase().includes(lower)
      );
    }

    return convs;
  }, [allConversations, toneFilter, debouncedSearch]);

  const totalMessages = filteredConversations.reduce((sum, c) => sum + c.messageCount, 0);

  const selectedConversation = useMemo(
    () => filteredConversations.find((c) => c.conversationId === selectedConvId) ?? null,
    [filteredConversations, selectedConvId]
  );

  // Use hook to detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap px-1 pb-3">
        <Select value={toneFilter} onValueChange={setToneFilter}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Tom" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tons</SelectItem>
            <SelectItem value="ok">Ok</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="alerta">Alerta</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[110px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar conversas..."
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Counter */}
      <div className="px-1 pb-2 text-xs text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-3 w-48" />
        ) : (
          <>
            {filteredConversations.length} conversa{filteredConversations.length !== 1 ? "s" : ""}
            {" · "}
            {totalMessages.toLocaleString("pt-BR")} msg{totalMessages !== 1 ? "s" : ""}
            {" · "}
            últimos {period} dias
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 min-h-0 border border-border rounded-lg overflow-hidden bg-card">
        {/* Conversation list */}
        <div
          className={cn(
            "flex-1 min-w-0 overflow-hidden",
            selectedConversation && !isMobile ? "border-r border-border" : ""
          )}
        >
          <ScrollArea className="h-full">
            {isLoading ? (
              <ConversationListSkeleton />
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conversa encontrada para o período selecionado
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <ConversationRow
                  key={conv.conversationId}
                  conversation={conv}
                  isSelected={conv.conversationId === selectedConvId}
                  onClick={() => setSelectedConvId(conv.conversationId)}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Thread panel — desktop */}
        {selectedConversation && !isMobile && (
          <div className="w-[420px] shrink-0">
            <ThreadPanel
              conversation={selectedConversation}
              onClose={() => setSelectedConvId(null)}
            />
          </div>
        )}

        {/* Thread panel — mobile sheet */}
        {isMobile && (
          <Sheet open={!!selectedConversation} onOpenChange={(open) => !open && setSelectedConvId(null)}>
            <SheetContent side="right" className="p-0 w-full sm:max-w-full">
              {selectedConversation && (
                <ThreadPanel
                  conversation={selectedConversation}
                  onClose={() => setSelectedConvId(null)}
                />
              )}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
};
