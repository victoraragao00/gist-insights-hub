import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import DOMPurify from "dompurify";
import {
  Bold, Italic, List, ListOrdered, Link2 as LinkIcon, Image as ImageIcon, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  uploadInlineImage,
  useResolveStoragePaths,
} from "@/hooks/useDemandAttachments";

const SANITIZE_OPTIONS = {
  ADD_ATTR: ["data-storage-path", "target", "rel"],
};

function extractStoragePaths(html: string): string[] {
  const out: string[] = [];
  const re = /data-storage-path="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function rewriteImageSrcs(root: HTMLElement, map: Record<string, string>) {
  root.querySelectorAll<HTMLImageElement>("img[data-storage-path]").forEach((img) => {
    const path = img.getAttribute("data-storage-path");
    if (path && map[path]) {
      if (img.getAttribute("src") !== map[path]) img.setAttribute("src", map[path]);
    }
  });
}

interface RichTextEditorProps {
  value: string;
  onSave: (html: string) => void;
  demandId: string;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export function RichTextEditor({
  value,
  onSave,
  demandId,
  placeholder,
  minHeight = 80,
  className,
}: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const lastSavedRef = useRef(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback(
    async (editor: Editor, file: File) => {
      if (!file.type.startsWith("image/")) return false;
      setUploading(true);
      try {
        const { storagePath, signedUrl } = await uploadInlineImage(demandId, file);
        editor
          .chain()
          .focus()
          .setImage({ src: signedUrl, alt: file.name } as { src: string; alt?: string })
          .run();
        // Annotate the just-inserted image with its storage path so we can re-sign later.
        // Tiptap's Image extension doesn't accept custom attrs by default; do it via DOM.
        queueMicrotask(() => {
          const dom = editor.view.dom as HTMLElement;
          const imgs = dom.querySelectorAll<HTMLImageElement>(`img[src="${signedUrl}"]`);
          imgs.forEach((img) => img.setAttribute("data-storage-path", storagePath));
          // Trigger an update so the new attribute is persisted
          editor.commands.focus();
        });
        return true;
      } catch (err) {
        toast.error("Erro ao enviar imagem: " + (err instanceof Error ? err.message : String(err)));
        return false;
      } finally {
        setUploading(false);
      }
    },
    [demandId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            "data-storage-path": {
              default: null,
              parseHTML: (el) => el.getAttribute("data-storage-path"),
              renderHTML: (attrs) => {
                const v = attrs["data-storage-path"];
                return v ? { "data-storage-path": v } : {};
              },
            },
          };
        },
      }).configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "prose-img:rounded-md prose-img:my-2",
          "px-3 py-2",
        ),
        style: `min-height:${minHeight}px;`,
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const imageFiles = files.filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        imageFiles.forEach((f) => editor && handleImageFile(editor, f));
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        const imageFiles = files.filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        imageFiles.forEach((f) => editor && handleImageFile(editor, f));
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = DOMPurify.sanitize(ed.getHTML(), SANITIZE_OPTIONS) as string;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (html !== lastSavedRef.current) {
          lastSavedRef.current = html;
          onSave(html);
        }
      }, 600);
    },
  });

  // Sync incoming value (e.g. demand changed)
  useEffect(() => {
    if (!editor) return;
    if (value !== lastSavedRef.current) {
      lastSavedRef.current = value;
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  // Resolve signed URLs for stored images
  const paths = useMemo(() => extractStoragePaths(value || ""), [value]);
  const { data: signedMap = {} } = useResolveStoragePaths(paths);

  useEffect(() => {
    if (!editor) return;
    rewriteImageSrcs(editor.view.dom as HTMLElement, signedMap);
  }, [editor, signedMap, value]);

  if (!editor) return null;

  const triggerFile = () => fileInputRef.current?.click();
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleImageFile(editor, f);
    e.target.value = "";
  };

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-border px-1 py-1">
        <ToolbarBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Negrito (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Itálico (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Lista">
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Lista numerada">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive("link")} onClick={setLink} label="Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={triggerFile} label="Inserir imagem">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
        {uploading && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground pr-1">
            <Loader2 className="h-3 w-3 animate-spin" /> enviando…
          </span>
        )}
      </div>
      <EditorContent editor={editor} />
      {placeholder && editor.isEmpty && (
        <div className="pointer-events-none -mt-[1px] px-3 pb-2 text-sm text-muted-foreground">
          {placeholder}
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  children, onClick, active, label,
}: { children: React.ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("h-7 w-7 p-0", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
