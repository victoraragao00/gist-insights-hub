import { useEffect, useRef, useState, KeyboardEvent } from "react";
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
}

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

export function CommentInput({ onSubmit, pending }: CommentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

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

  const filtered = users
    .filter((u) => {
      const q = mentionQuery.toLowerCase();
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    })
    .slice(0, 5);

  useEffect(() => {
    setActiveIdx(0);
  }, [mentionQuery, showMentions]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setText(val);
    const before = val.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
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
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const label = user.full_name || user.email || "usuário";
    const token = `@[${label}](${user.id}) `;
    const next = before.slice(0, atIdx) + token + after;
    setText(next);
    setShowMentions(false);
    requestAnimationFrame(() => {
      const newPos = atIdx + token.length;
      ta?.focus();
      ta?.setSelectionRange(newPos, newPos);
    });
  };

  const handleSubmit = () => {
    if (!text.trim() || pending) return;
    const mentionedUserIds = [...text.matchAll(MENTION_TOKEN_RE)].map((m) => m[2]);
    onSubmit({ content: text.trim(), mentionedUserIds });
    setText("");
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
        rows={2}
      />

      {showMentions && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {filtered.map((u, idx) => {
            const label = u.full_name || u.email || "usuário";
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  idx === activeIdx ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {getInitials(label)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs truncate">{label}</p>
                  {u.email && (
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!text.trim() || pending}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
        Comentar
      </Button>
    </div>
  );
}
