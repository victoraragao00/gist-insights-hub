import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useClientConversations,
  useConversationMessages,
  useLinkInteractions,
  type ClientConversation,
} from "@/hooks/useDemandInteractions";
import type { DemandRow } from "@/hooks/useDemands";

interface LinkConversationDialogProps {
  demand: DemandRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIDE_BADGE: Record<string, string> = {
  client: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  umode: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

function truncate(text: string | null | undefined, max: number) {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function LinkConversationDialog({ demand, open, onOpenChange }: LinkConversationDialogProps) {
  const [selectedConv, setSelectedConv] = useState<ClientConversation | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autoLinkConv, setAutoLinkConv] = useState<string | null>(null);

  const { data: conversations = [], isLoading: loadingConvs } = useClientConversations(
    open ? demand.client_id : undefined
  );
  const { data: messages = [], isLoading: loadingMsgs } = useConversationMessages(
    selectedConv?.conversation_id,
    demand.client_id
  );
  const linkMutation = useLinkInteractions();

  // Auto-link entire conversation when messages load
  useEffect(() => {
    if (autoLinkConv && selectedConv && messages.length > 0 && !loadingMsgs) {
      const allIds = messages.map((m) => m.id);
      linkMutation.mutate(
        {
          demandId: demand.id,
          interactionIds: allIds,
          conversationId: autoLinkConv,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            setSelectedConv(null);
            setSelectedIds(new Set());
            setAutoLinkConv(null);
          },
          onError: () => {
            setAutoLinkConv(null);
          },
        }
      );
      setAutoLinkConv(null);
    }
  }, [autoLinkConv, messages, loadingMsgs, selectedConv]);
  const handleSelectConv = (conv: ClientConversation) => {
    setSelectedConv(conv);
    setSelectedIds(new Set());
  };

  const handleBack = () => {
    setSelectedConv(null);
    setSelectedIds(new Set());
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  };

  const handleLink = () => {
    if (!selectedConv || selectedIds.size === 0) return;
    linkMutation.mutate(
      {
        demandId: demand.id,
        interactionIds: Array.from(selectedIds),
        conversationId: selectedConv.conversation_id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedConv(null);
          setSelectedIds(new Set());
        },
      }
    );
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setSelectedConv(null);
      setSelectedIds(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {selectedConv ? "Selecionar mensagens" : "Vincular conversa ao ticket"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-0">
          {/* Passo 1: lista de conversas */}
          {!selectedConv && (
            <>
              {loadingConvs && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              )}
              {!loadingConvs && conversations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma conversa encontrada para este cliente
                </p>
              )}
              {conversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {conv.contact_name || `Conversa ${conv.conversation_id}`}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">
                        {conv.conversation_id}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {conv.message_count} msgs
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground line-clamp-2">{truncate(conv.last_content, 120)}</p>
                  <p className="text-xs text-muted-foreground">
                    Última mensagem:{" "}
                    {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      disabled={linkMutation.isPending}
                      onClick={() => {
                        // Vincular inteira — fetch all messages then link
                        handleSelectConv(conv);
                        // We set a flag to auto-link after messages load
                        setAutoLinkConv(conv.conversation_id);
                      }}
                    >
                      {linkMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Vincular inteira
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={() => handleSelectConv(conv)}
                    >
                      Selecionar mensagens
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Passo 2: lista de mensagens */}
          {selectedConv && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size} de {messages.length} selecionadas
                </span>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleSelectAll}>
                  {selectedIds.size === messages.length ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              </div>

              {loadingMsgs && (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              )}

              {messages.map((msg) => (
                <label
                  key={msg.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(msg.id)}
                    onCheckedChange={() => handleToggle(msg.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{msg.sender_raw ?? "—"}</span>
                      {msg.sender_side && (
                        <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${SIDE_BADGE[msg.sender_side] ?? "bg-muted text-muted-foreground"}`}>
                          {msg.sender_side === "client" ? "Cliente" : "uMode"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {formatDistanceToNow(new Date(msg.occurred_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3">{truncate(msg.content, 200)}</p>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          {selectedConv ? (
            <>
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleLink}
                disabled={selectedIds.size === 0 || linkMutation.isPending}
              >
                {linkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Vincular {selectedIds.size > 0 ? `${selectedIds.size} mensagem${selectedIds.size > 1 ? "s" : ""}` : ""}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
