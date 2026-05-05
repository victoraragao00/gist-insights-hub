import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

type Variant = "danger" | "warn" | "ok";

interface AlertItemView {
  primary: string;
  right: string;
}

interface CardData {
  key: string;
  label: string;
  variant: Variant;
  num: number;
  sub: string;
  items: AlertItemView[];
  onClick: () => void;
}

const variantStyles: Record<Variant, { num: string; ring: string }> = {
  danger: {
    num: "text-destructive",
    ring: "hover:border-destructive/40",
  },
  warn: {
    num: "text-amber-600 dark:text-amber-400",
    ring: "hover:border-amber-400/50",
  },
  ok: {
    num: "text-emerald-600 dark:text-emerald-400",
    ring: "hover:border-emerald-400/50",
  },
};

function AlertCard({ card }: { card: CardData }) {
  const styles = variantStyles[card.variant];
  return (
    <button
      type="button"
      onClick={card.onClick}
      className={cn(
        "text-left rounded-xl border border-border bg-card p-4 transition-all",
        "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring",
        styles.ring,
      )}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {card.label}
        </span>
      </div>
      <div className={cn("text-2xl font-medium", styles.num)}>{card.num}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</div>
      {card.items.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-2">
          {card.items.map((it, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <span className="truncate text-muted-foreground">{it.primary}</span>
              <span className="font-medium text-foreground/80 shrink-0">
                {it.right}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

interface Props {
  data: TechDashboardData["alerts"];
  period: number;
  onNavigate: (path: string) => void;
}

export function AlertCards({ data, period, onNavigate }: Props) {
  const delivered = data.delivered;
  const prev = delivered.count_previous ?? 0;
  const curr = delivered.count_current ?? 0;
  const delta =
    prev === 0
      ? curr > 0
        ? "+100%"
        : "—"
      : `${curr >= prev ? "+" : ""}${Math.round(((curr - prev) / prev) * 100)}%`;

  const cards: CardData[] = [
    {
      key: "blocked",
      label: "Bloqueadas",
      variant: "danger",
      num: data.blocked.count,
      sub: "há mais de 3 dias",
      items: (data.blocked.items ?? []).slice(0, 2).map((i) => ({
        primary: i.title,
        right: `${i.days ?? 0}d`,
      })),
      onClick: () => onNavigate("/demands?workspace=tech&filter=blocked"),
    },
    {
      key: "overloaded",
      label: "Sobrecarregados",
      variant: "warn",
      num: data.overloaded.count,
      sub: "pessoas com WIP > 3",
      items: (data.overloaded.items ?? []).slice(0, 2).map((i) => ({
        primary: i.name ?? i.email ?? i.title ?? "—",
        right: `${i.wip_count ?? 0} em andamento`,
      })),
      onClick: () => onNavigate("/demands?workspace=tech&filter=overloaded"),
    },
    {
      key: "forgotten",
      label: "Esquecidas",
      variant: "warn",
      num: data.forgotten.count,
      sub: "sem atividade > 7 dias",
      items: (data.forgotten.items ?? []).slice(0, 2).map((i) => ({
        primary: i.title,
        right: `${i.days ?? 0}d`,
      })),
      onClick: () => onNavigate("/demands?workspace=tech&filter=forgotten"),
    },
    {
      key: "delivered",
      label: `Entregues (${period}d)`,
      variant: "ok",
      num: curr,
      sub: `${delta} vs período anterior`,
      items: (delivered.by_area ?? []).slice(0, 3).map((a) => ({
        primary: a.area_name ?? "Sem área",
        right: String(a.count),
      })),
      onClick: () => onNavigate("/demands?workspace=tech&filter=delivered"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((c) => (
        <AlertCard key={c.key} card={c} />
      ))}
    </div>
  );
}
