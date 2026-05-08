import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProjectRow } from "@/hooks/useProjects";

export type CalendarMode = "planned" | "actual";

interface Props {
  projects: ProjectRow[];
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
}

interface BarItem {
  project: ProjectRow;
  start: Date;
  end: Date;
  startCol: number; // 1..N
  spanCols: number;
  clipsLeft: boolean;
  clipsRight: boolean;
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  return new Date(v + "T00:00:00");
}

export function ProjectsCalendarView({ projects, mode, onModeChange }: Props) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const totalDays = differenceInCalendarDays(monthEnd, monthStart) + 1;

  const bars: BarItem[] = useMemo(() => {
    const out: BarItem[] = [];
    for (const p of projects) {
      const startRaw = parseDate(mode === "planned" ? p.planned_start_date : p.actual_start_date);
      const endRaw = parseDate(mode === "planned" ? p.planned_end_date : p.actual_end_date);
      if (!startRaw && !endRaw) continue;
      const s = startRaw ?? endRaw!;
      const e = endRaw ?? startRaw!;
      if (isAfter(s, monthEnd) || isBefore(e, monthStart)) continue;
      const clampedStart = isBefore(s, monthStart) ? monthStart : s;
      const clampedEnd = isAfter(e, monthEnd) ? monthEnd : e;
      const startCol = differenceInCalendarDays(clampedStart, monthStart) + 1;
      const spanCols = differenceInCalendarDays(clampedEnd, clampedStart) + 1;
      out.push({
        project: p,
        start: s,
        end: e,
        startCol,
        spanCols: Math.max(1, spanCols),
        clipsLeft: isBefore(s, monthStart),
        clipsRight: isAfter(e, monthEnd),
      });
    }
    // Sort: client name then start date
    out.sort((a, b) => {
      const ca = a.project.is_internal ? "zzz" : (a.project.clients?.name ?? "zzy");
      const cb = b.project.is_internal ? "zzz" : (b.project.clients?.name ?? "zzy");
      const cmp = ca.localeCompare(cb, "pt-BR");
      if (cmp !== 0) return cmp;
      return a.startCol - b.startCol;
    });
    return out;
  }, [projects, mode, monthStart, monthEnd]);

  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold capitalize min-w-[140px] text-center">
            {format(monthStart, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Hoje
          </Button>
        </div>
        <div className="inline-flex items-center rounded-full border border-border p-0.5 bg-background">
          <button
            type="button"
            onClick={() => onModeChange("planned")}
            className={cn(
              "text-xs px-3 py-1 rounded-full transition-colors",
              mode === "planned" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Previsto
          </button>
          <button
            type="button"
            onClick={() => onModeChange("actual")}
            className={cn(
              "text-xs px-3 py-1 rounded-full transition-colors",
              mode === "actual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Real
          </button>
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
          Nenhum projeto com datas {mode === "planned" ? "previstas" : "reais"} neste mês.
        </div>
      ) : (
        <div className="border border-border rounded-2xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${260 + totalDays * 28}px` }}>
              {/* Header */}
              <div
                className="grid border-b border-border bg-muted/30 text-[10px] text-muted-foreground"
                style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(28px, 1fr))` }}
              >
                <div className="px-3 py-2 font-medium uppercase tracking-wide">Projeto</div>
                {dayNumbers.map((d) => (
                  <div key={d} className="text-center py-2 border-l border-border/50">
                    {d}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {bars.map((bar) => (
                <div
                  key={bar.project.id}
                  className="grid border-b border-border/40 hover:bg-muted/20 group"
                  style={{ gridTemplateColumns: `260px repeat(${totalDays}, minmax(28px, 1fr))` }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${bar.project.id}`)}
                    className="px-3 py-2 text-left flex flex-col gap-0.5 border-r border-border/50 min-w-0"
                  >
                    <span className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                      {bar.project.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 truncate">
                      <Building2 className="h-2.5 w-2.5 shrink-0" />
                      {bar.project.is_internal ? "Interno" : (bar.project.clients?.name ?? "—")}
                    </span>
                  </button>
                  <div
                    className="relative col-span-full row-start-1 my-1.5 mx-px h-7 pointer-events-none"
                    style={{
                      gridColumnStart: 2 + (bar.startCol - 1),
                      gridColumnEnd: 2 + (bar.startCol - 1) + bar.spanCols,
                    }}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-md flex items-center px-2 text-[10px] font-medium pointer-events-auto cursor-pointer truncate",
                        mode === "planned"
                          ? "bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25",
                        bar.clipsLeft && "rounded-l-none",
                        bar.clipsRight && "rounded-r-none",
                      )}
                      onClick={() => navigate(`/projects/${bar.project.id}`)}
                      title={`${format(bar.start, "dd/MM/yyyy")} → ${format(bar.end, "dd/MM/yyyy")}`}
                    >
                      <span className="truncate">
                        {format(bar.start, "dd/MM")} – {format(bar.end, "dd/MM")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
