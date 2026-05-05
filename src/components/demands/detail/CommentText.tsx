interface CommentTextProps {
  text: string;
}

const MENTION_REGEX = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

/** Renders comment text, highlighting `@[Name](uuid)` mention tokens. */
export function CommentText({ text }: CommentTextProps) {
  const parts: Array<{ type: "text" | "mention"; value: string; key: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(MENTION_REGEX.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index), key: `t${i++}` });
    }
    parts.push({ type: "mention", value: match[1], key: `m${i++}` });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex), key: `t${i++}` });
  }

  return (
    <p className="text-foreground whitespace-pre-wrap">
      {parts.map((p) =>
        p.type === "mention" ? (
          <span key={p.key} className="text-primary font-medium">@{p.value}</span>
        ) : (
          <span key={p.key}>{p.value}</span>
        )
      )}
    </p>
  );
}
