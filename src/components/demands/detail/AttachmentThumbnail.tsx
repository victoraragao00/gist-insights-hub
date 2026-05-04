import { FileText, Link2, ExternalLink } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AttachmentRow = Tables<"demand_attachments">;

interface AttachmentThumbnailProps {
  attachment: AttachmentRow;
  signedUrl?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function AttachmentThumbnail({ attachment, signedUrl }: AttachmentThumbnailProps) {
  const isImage = attachment.type === "file" && attachment.mime_type?.startsWith("image/");
  const href = signedUrl ?? (attachment.type === "link" ? attachment.url ?? "#" : "#");
  const label =
    attachment.type === "link"
      ? hostnameOf(attachment.url ?? "")
      : attachment.filename ?? "arquivo";

  if (isImage && href !== "#") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block rounded-lg overflow-hidden border border-border bg-muted aspect-video"
        title={attachment.filename ?? ""}
      >
        <img
          src={href}
          alt={attachment.filename ?? "imagem"}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted/50 transition-colors min-w-0"
      title={label}
    >
      {attachment.type === "link" ? (
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className="text-sm text-foreground truncate flex-1">{label}</span>
      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
    </a>
  );
}
