import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { priorityBadgeClass, priorityLabel } from "./detail/priorityBadgeStyles";
import type { DemandPriority } from "@/hooks/useDemands";

interface DemandSlaQuickSheetProps {
  demandId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuickDemand {
  id: string;
  title: string;
  description: string | null;
  expected_result: string | null;
  notes: string | null;
  resolution: string | null;
  priority: string;
  clients: { name: string } | null;
  demand_types: { name: string; color: string | null } | null;
  demand_areas: { name: string; color: string | null } | null;
  ticket_columns: { name: string; color: string | null } | null;
  user_profiles: { full_name: string | null; email: string | null } | null;
  rfis: { code: string }[] | null;
}

export function DemandSlaQuickSheet({ demandId, open, onOpenChange }: DemandSlaQuickSheetProps) {
  const navigate = useNavigate();

  const { data: demand, isLoading } = useQuery<QuickDemand | null>({
    queryKey: ["demand_sla_quick", demandId],
    enabled: open && !!demandId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select(
          "id, title, description, expected_result, notes, resolution, priority, clients(name), demand_types(name, color), demand_areas(name, color), ticket_columns(name, color), user_profiles!assignee_id(full_name, email), rfis(code)",
        )
        .eq("id", demandId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as QuickDemand | null;
    },
  });

  const goToFull = () => {
    if (!demand) return;
    onOpenChange(false);
    navigate(`/demands/${demand.id}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[560px] flex flex-col p-0 overflow-hidden"
      >
        {isLoading || !demand ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3 mb-3">
                <SheetTitle className="text-base font-semibold leading-snug flex-1">
                  {demand.title}
                </SheetTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 text-xs mr-8"
                  onClick={goToFull}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir completo
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {demand.demand_types?.name && (
                  <Badge variant="outline" className="text-[11px] h-5">
                    {demand.demand_types.name}
                  </Badge>
                )}
                {demand.demand_areas?.name && (
                  <Badge
                    variant="outline"
                    className="text-[11px] h-5 bg-muted text-muted-foreground"
                  >
                    {demand.demand_areas.name}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn("text-[11px] h-5", priorityBadgeClass(demand.priority))}
                >
                  {priorityLabel(demand.priority)}
                </Badge>
                {demand.ticket_columns?.name && (
                  <Badge variant="outline" className="text-[11px] h-5">
                    {demand.ticket_columns.name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Responsável</p>
                  <p className="font-medium">
                    {demand.user_profiles?.full_name ?? demand.user_profiles?.email ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                  <p className="font-medium">{demand.clients?.name ?? "—"}</p>
                </div>
                {demand.rfis && demand.rfis.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">RFI</p>
                    <p className="font-medium font-mono text-xs">{demand.rfis[0].code}</p>
                  </div>
                )}
              </div>

              {demand.description && (
                <ReadOnlyField label="Descrição" value={demand.description} />
              )}
              {demand.expected_result && (
                <ReadOnlyField label="Resultado esperado" value={demand.expected_result} />
              )}
              {demand.notes && <ExpandableField label="Notas internas" value={demand.notes} />}
              {demand.resolution && (
                <ReadOnlyField label="Resolução" value={demand.resolution} />
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-3 border-t border-border bg-muted/20">
              <Button className="w-full gap-2" onClick={goToFull}>
                <ExternalLink className="h-4 w-4" />
                Abrir demanda completa
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function ExpandableField({ label, value }: { label: string; value: string }) {
  const THRESHOLD = 80;
  const [expanded, setExpanded] = useState(false);
  const [isTall, setIsTall] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) setIsTall(ref.current.scrollHeight > THRESHOLD);
  }, [value]);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div
        ref={ref}
        className={cn(
          "text-sm leading-relaxed text-foreground whitespace-pre-wrap overflow-hidden transition-all duration-200",
          !expanded && isTall && "max-h-20",
        )}
      >
        {value}
      </div>
      {isTall && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Ver mais
            </>
          )}
        </button>
      )}
    </div>
  );
}
