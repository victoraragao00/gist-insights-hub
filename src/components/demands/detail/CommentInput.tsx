import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface CommentInputProps {
  onSubmit: (input: { content: string; mentionedUserIds: string[] }) => void;
  pending: boolean;
  initialText?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}

const TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;
const HANDLE_CHAR = /[\w.\-]/;

/** "laura.delgado@umode.tech" → "laura.delgado"; fallback to slugged full_name. */
function userHandle(u: UserOption): string {
  const fromEmail = u.email?.split("@")[0];
  if (fromEmail) return fromEmail;
  return (u.full_name ?? "usuario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/** Token form `@[label](uuid)` → plain `@handle` for editing. */
export function tokensToPlain(text: string, users: UserOption[]): string {
  const byId = new Map(users.map((u) => [u.id, userHandle(u)]));
  return text.replace(TOKEN_RE, (_m, label: string, id: string) => {
    return `@${byId.get(id) ?? label}`;
  });
}

/** Plain `@handle` → token form, using map populated as user picks suggestions. */
function plainToTokens(
  text: string,
  handleMap: Map<string, { id: string; label: string }>,
): { content: string; mentionedUserIds: string[] } {
  const ids: string[] = [];
  const content = text.replace(/@([\w.\-]+)/g, (full, handle: string) => {
    const hit = handleMap.get(handle);
    if (!hit) return full;
    ids.push(hit.id);
    return `@[${hit.label}](${hit.id})`;
  });
  return { content, mentionedUserIds: Array.from(new Set(ids)) };
}

export function CommentInput({
  onSubmit,
  pending,
  initialText = "",
  submitLabel = "Comentar",
  onCancel,
  autoFocus,
  compact,
}: CommentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(initialText);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // handle → { id, label } populated each time the user picks from suggestions
  const handleMapRef = useRef<Map<string, { id: string; label: string }>>(new Map());

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["user_profiles_mentions"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserOption[];
    },
  });

  // Pre-populate handle map from known users so editing a comment that already
  // contains plain @handles re-resolves them on submit.
  useEffect(() => {
    users.forEach((u) => {
      const h = userHandle(u);
      const label = u.full_name || u.email || h;
      if (!handleMapRef.current.has(h)) {
        handleMapRef.current.set(h, { id: u.id, label });
      }
    });
  }, [users]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const filtered = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return users
      .filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          userHandle(u).toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [users, mentionQuery]);

  useEffect(() => {
    setActiveIdx(0);
  }, [mentionQuery, showMentions]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setText(val);
    const before = val.slice(0, cursor);
    const m = before.match(/@([\w.\-]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: UserOption) => {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    // find the start of the current @token (before cursor) and end of any handle chars after
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    let endIdx = 0;
    while (endIdx < after.length && HANDLE_CHAR.test(after[endIdx])) endIdx += 1;
    const handle = userHandle(user);
    const label = user.full_name || user.email || handle;
    handleMapRef.current.set(handle, { id: user.id, label });
    const insertion = `@${handle} `;
    const next = before.slice(0, atIdx) + insertion + after.slice(endIdx);
    setText(next);
    setShowMentions(false);
    requestAnimationFrame(() => {
      const newPos = atIdx + insertion.length;
      ta?.focus();
      ta?.setSelectionRange(newPos, newPos);
    });
  };

  const handleSubmit = () => {
    if (!text.trim() || pending) return;
    const { content, mentionedUserIds } = plainToTokens(text, handleMapRef.current);
    onSubmit({ content: content.trim(), mentionedUserIds });
    if (!onCancel) setText(""); // create flow clears, edit flow keeps until parent unmounts
    setShowMentions(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="relative space-y-1.5">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Adicionar comentário... Use @ para mencionar"
        rows={compact ? 2 : 2}
        className={cn(compact && "text-xs")}
      />

      {showMentions && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {filtered.map((u, idx) => {
            const label = u.full_name || u.email || "usuário";
            return (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  idx === activeIdx ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {getInitials(label)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs truncate">{label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    @{userHandle(u)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          className={cn(compact && "h-6 text-xs px-2")}
          onClick={handleSubmit}
          disabled={!text.trim() || pending}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(compact && "h-6 text-xs px-2")}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
