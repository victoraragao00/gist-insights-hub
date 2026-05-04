interface AssigneeDisplayProps {
  fullName?: string | null;
  email?: string | null;
  size?: "sm" | "md";
  showName?: boolean;
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

export function AssigneeDisplay({
  fullName,
  email,
  size = "sm",
  showName = true,
}: AssigneeDisplayProps) {
  const display = fullName?.trim() || email?.trim() || "—";
  const initials = display === "—" ? "?" : initialsOf(display);
  const dim = size === "sm" ? "h-[22px] w-[22px] text-[10px]" : "h-7 w-7 text-xs";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className={`${dim} shrink-0 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-medium`}
        title={display}
      >
        {initials}
      </div>
      {showName && (
        <span className="text-sm text-foreground truncate">{display}</span>
      )}
    </div>
  );
}
