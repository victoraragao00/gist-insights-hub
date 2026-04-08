import { useMemo, useState } from "react";
import { useClientConversationsStatus, type ConversationWithStatus } from "@/hooks/useClientConversationsStatus";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, ChevronDown } from "lucide-react";

const STATUS_CONFIG = {
  sem_resposta: {
    label: "Sem resposta",
    className: "bg-orange-50 text-orange-600 border-orange-200",
    description: "Cliente aguarda resposta da uMode",
  },
  em_andamento: {
    label: "Em andamento",
    className: "bg-blue-50 text-blue-600 border-blue-200",
    description: "uMode respondeu recentemente",
  },
  inativo: {
    label: "Inativo",
    className: "bg-muted text-muted-foreground border-border",
    description: "Sem mensagens há mais de 7 dias",
  },
} as const;

const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  atencao: { label: "Atenção", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  alerta: { label: "Alerta", className: "bg-orange-50 text-orange-700 border-orange-200" },
  critico: { label: "Crítico", className: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_ORDER: Record<string, number> = { sem_resposta: 0, em_andamento: 1, inativo: 2 };

type StatusFilter = "todos" | "sem_resposta" | "em_andamento" | "inativo";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

interface Props {
  clientId: string;
  expandedConversation?: string | null;
  onToggleExpand?: (id: string) => void;
  onViewFullConversation?: () => void;
}

export default function ClientConversationsTab({ clientId, expandedConversation, onToggleExpand, onViewFullConversation }: Props) {
  const { data, isLoading } = useClientConversationsStatus(clientId);
  const [filter, setFilter] = useState<StatusFilter>("todos");

  const counts = useMemo(() => {
    if (!data) return { sem_resposta: 0, em_andamento: 0, inativo: 0 };
    return {
      sem_resposta: data.filter((c) => c.status === "sem_resposta").length,
      em_andamento: data.filter((c) => c.status === "em_andamento").length,
      inativo: data.filter((c) => c.status === "inativo").length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = filter === "todos" ? data : data.filter((c) => c.status === filter);
    return [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: "todos", label: `Todos (${data?.length ?? 0})` },
    { key: "sem_resposta", label: `Sem resposta (${counts.sem_resposta})` },
    { key: "em_andamento", label: `Em andamento (${counts.em_andamento})` },
    { key: "inativo", label: `Inativo (${counts.inativo})` },
  ];

  const emptyMessages: Record<StatusFilter, string> = {
    todos: "Nenhuma conversa encontrada para este cliente.",
    sem_resposta: "Nenhuma conversa aguardando resposta.",
    em_andamento: "Nenhuma conversa em andamento.",
    inativo: "Nenhuma conversa inativa.",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map((fb) => (
          <Button
            key={fb.key}
            variant={filter === fb.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(fb.key)}
          >
            {fb.label}
          </Button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <MessageSquare className="h-10 w-10 opacity-40" />
          <p className="text-sm">{emptyMessages[filter]}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv) => (
            <ConversationItem
              key={conv.conversation_id}
              conv={conv}
              isExpanded={expandedConversation === conv.conversation_id}
              onToggle={onToggleExpand ? () => onToggleExpand(conv.conversation_id) : undefined}
              onViewFull={onViewFullConversation}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationItem({ conv, isExpanded, onToggle, onViewFull }: {
  conv: ConversationWithStatus;
  isExpanded?: boolean;
  onToggle?: () => void;
  onViewFull?: () => void;
}) {
  const statusCfg = STATUS_CONFIG[conv.status] ?? STATUS_CONFIG.em_andamento;
  const toneCfg = TONE_CONFIG[conv.worst_tone] ?? TONE_CONFIG.ok;
  const preview = conv.last_message ? stripHtml(conv.last_message).slice(0, 120) : "Sem conteúdo";

  return (
    <div>
      <div
        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${onToggle ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/30"} ${isExpanded ? "border-primary/30 bg-muted/20" : ""}`}
        onClick={onToggle}
      >
        <Avatar className="h-10 w-10 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {getInitials(conv.contact_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">
              {conv.contact_name ?? "Contato desconhecido"}
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusCfg.className}`}>
              {statusCfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
              {formatDistanceToNow(new Date(conv.last_occurred_at), { addSuffix: true, locale: ptBR })}
            </span>
            {onToggle && (
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            )}
          </div>

          {/* Row 2 */}
          <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>

          {/* Row 3 */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${toneCfg.className}`}>
              {toneCfg.label}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {conv.total_messages} mensagens
            </span>
          </div>
        </div>
      </div>

      {/* Expanded messages */}
      {isExpanded && (
        <ConversationMessages conversationId={conv.conversation_id} onViewFull={onViewFull} />
      )}
    </div>
  );
}

function ConversationMessages({ conversationId, onViewFull }: { conversationId: string; onViewFull?: () => void }) {
  const { data: messages, isLoading } = useConversationMessages(conversationId);

  if (isLoading) {
    return (
      <div className="mt-2 ml-12 space-y-2 border-l-2 border-border pl-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="mt-2 ml-12 border-l-2 border-border pl-3 py-2">
        <p className="text-xs text-muted-foreground">Nenhuma mensagem encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 ml-12 space-y-2 border-l-2 border-border pl-3">
      {messages.map((msg) => (
        <div key={msg.id} className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Badge className={msg.sender_side === "umode"
              ? "bg-blue-50 text-blue-600 border-blue-200 text-xs"
              : "bg-orange-50 text-orange-600 border-orange-200 text-xs"
            } variant="outline">
              {msg.sender_side === "umode" ? "uMode" : "Cliente"}
            </Badge>
            <span className="text-xs text-muted-foreground">{msg.sender_raw}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(msg.occurred_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <p
            className="text-xs text-foreground line-clamp-3"
            dangerouslySetInnerHTML={{ __html: msg.content ?? "—" }}
          />
        </div>
      ))}

      {onViewFull && (
        <button
          className="text-xs text-primary hover:underline mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onViewFull();
          }}
        >
          Ver conversa completa →
        </button>
      )}
    </div>
  );
}
