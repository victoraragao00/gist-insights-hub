import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  user: { full_name?: string | null; email?: string | null } | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MemberAvatar({ user, size = "sm", className }: MemberAvatarProps) {
  const label = user?.full_name || user?.email || "?";
  const sizes = size === "md" ? "w-8 h-8 text-xs" : "w-6 h-6 text-[10px]";
  return (
    <div
      title={label}
      className={cn(
        "rounded-full bg-primary/10 text-primary border-2 border-background flex items-center justify-center font-medium shrink-0",
        sizes,
        className,
      )}
    >
      {initialsOf(label)}
    </div>
  );
}
