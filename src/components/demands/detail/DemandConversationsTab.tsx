import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, MessageSquare, Sparkles, Loader2, X, ChevronDown } from "lucide-react";
import { CommentInput } from "./CommentInput";
import { CommentText } from "./CommentText";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import type { DemandRow } from "@/hooks/useDemands";
import { useDemandInteractions, useUnlinkInteraction } from "@/hooks/useDemandInteractions";
import {
  useConversationSummaries, useSummarizeConversation,
} from "@/hooks/useDemandConversationSummaries";
import {
  useDemandComments, useCreateComment, useUpdateComment, useDeleteComment,
  type DemandComment,
} from "@/hooks/useDemandComments";
import { LinkConversationDialog } from "../LinkConversationDialog";

const SIDE_BADGE: Record<string, string> = {
  client: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  umode: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
};

interface DemandConversationsTabProps {
  demand: DemandRow;
}

export function DemandConversationsTab({ demand }: DemandConversationsTabProps) {
  const { user } = useAuth();
  const { data: linkedInteractions = [] } = useDemandInteractions(demand.id);
  const { data: convSummaries = [] } = useConversationSummaries(demand.id);
  const summarizeMutation = useSummarizeConversation();
  const unlinkMutation = useUnlinkInteraction();
  const { data: comments = [] } = useDemandComments(demand.id);
  const createCommentMutation = useCreateComment();

  const [linkConvOpen, setLinkConvOpen] = useState(false);

  const convGroups = linkedInteractions.reduce<Record<string, typeof linkedInteractions>>((acc, li) => {
    const key = li.interactions?.conversation_id ?? "sem-conversa";
    if (!acc[key]) acc[key] = [];
    acc[key].push(li);
    return acc;
  }, {});

  const handlePostComment = ({
    content,
    mentionedUserIds,
  }: { content: string; mentionedUserIds: string[] }) => {
    if (createCommentMutation.isPending) return;
    createCommentMutation.mutate({ demandId: demand.id, content, mentionedUserIds });
  };

  return (
    <div className="space-y-6">
      {/* Conversas vinculadas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">Conversas vinculadas</Label>
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => setLinkConvOpen(true)}
          >
            <Link2 className="h-3 w-3 mr-1" /> Vincular conversa
          </Button>
        </div>

        {linkedInteractions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma conversa vinculada</p>
        ) : (
          Object.entries(convGroups).map(([convId, items]) => {
            const firstClientSender = items.find(
              (li) => li.interactions?.sender_side === "client"
            )?.interactions?.sender_raw;
            const firstOccurred = items[0]?.interactions?.occurred_at;
            const summary = convSummaries.find((s) => s.conversation_id === convId);

            return (
              <div key={convId} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {firstClientSender ?? (convId === "sem-conversa" ? "Sem conversa" : convId.slice(0, 16) + "…")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{items.length} msg</Badge>
                    {firstOccurred && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(firstOccurred), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>

                {summary && (
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-foreground whitespace-pre-wrap">
                    {summary.summary}
                    <p className="text-muted-foreground mt-1">
                      Gerado {formatDistanceToNow(new Date(summary.generated_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                )}

                {convId !== "sem-conversa" && (
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs w-full"
                    onClick={() =>
                      summarizeMutation.mutate({
                        demand_id: demand.id,
                        conversation_id: convId,
                      })
                    }
                    disabled={summarizeMutation.isPending}
                  >
                    {summarizeMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Resumindo...</>
                    ) : (
                      <><Sparkles className="h-3 w-3 mr-1" /> {summary ? "Regenerar resumo" : "Resumir com IA"}</>
                    )}
                  </Button>
                )}

                <Collapsible>
                  <CollapsibleTrigger className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                    <ChevronDown className="h-3 w-3" /> Ver mensagens ({items.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {items.map((li) => (
                      <div key={li.id} className="flex items-start gap-2 text-xs group pl-2 border-l border-border">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{li.interactions?.sender_raw ?? "—"}</span>
                            {li.interactions?.sender_side && (
                              <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${SIDE_BADGE[li.interactions.sender_side] ?? "bg-muted text-muted-foreground"}`}>
                                {li.interactions.sender_side === "client" ? "Cliente" : "uMode"}
                              </span>
                            )}
                            {li.interactions?.occurred_at && (
                              <span className="text-muted-foreground ml-auto shrink-0">
                                {formatDistanceToNow(new Date(li.interactions.occurred_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            )}
                          </div>
                          <p
                            className="text-muted-foreground line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: li.interactions?.content ?? "—" }}
                          />
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0">
                              <X className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desvincular mensagem?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A mensagem será removida do vínculo com este ticket.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => unlinkMutation.mutate({ id: li.id, demandId: demand.id })}
                              >
                                Desvincular
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })
        )}

        <LinkConversationDialog
          demand={demand}
          open={linkConvOpen}
          onOpenChange={setLinkConvOpen}
        />
      </section>

      <Separator />

      {/* Comentários */}
      <section className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Comentários</Label>

        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum comentário ainda</p>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              demandId={demand.id}
              currentUserId={user?.id}
            />
          ))}
        </div>

        <CommentInput
          onSubmit={handlePostComment}
          pending={createCommentMutation.isPending}
        />
      </section>
    </div>
  );
}

function CommentItem({
  comment,
  demandId,
  currentUserId,
}: {
  comment: DemandComment;
  demandId: string;
  currentUserId: string | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const isOwner = comment.created_by === currentUserId;

  const handleSave = () => {
    if (!editContent.trim() || editContent === comment.content) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(
      { id: comment.id, demandId, content: editContent.trim() },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="flex gap-2 text-xs group">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
        {(comment.created_by ?? "?")[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {isOwner ? "Você" : (comment.created_by?.slice(0, 8) ?? "Usuário")}
          </span>
          {comment.created_at && (
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          )}
          {comment.edited && (
            <Badge variant="outline" className="text-xs px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
              editado
            </Badge>
          )}
          {isOwner && !editing && (
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost" size="sm" className="h-5 px-1.5 text-xs"
                onClick={() => { setEditContent(comment.content); setEditing(true); }}
              >
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs">
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ id: comment.id, demandId })}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        {editing ? (
          <div className="space-y-1.5 mt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm" className="h-6 text-xs px-2"
                onClick={handleSave}
                disabled={updateMutation.isPending || !editContent.trim()}
              >
                {updateMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Salvar
              </Button>
              <Button
                variant="ghost" size="sm" className="h-6 text-xs px-2"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <CommentText text={comment.content} />
        )}
      </div>
    </div>
  );
}
