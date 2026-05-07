import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useDemandRelationships,
  useDemandRelationshipRows,
  useAddRelationship,
  useRemoveRelationship,
  type RelationshipType,
  type DependencyItem,
} from "@/hooks/useDemandRelationships";

import { DependencyChip } from "./DependencyChip";

const TYPE_CONFIG: Record<
  RelationshipType,
  { label: string; icon: string; desc: string }
> = {
  blocks: {
    label: "Bloqueia",
    icon: "🔒",
    desc: "Esta demanda é antecessora — a outra só inicia quando esta concluir",
  },
  related: {
    label: "Complementar",
    icon: "🔗",
    desc: "Se influenciam mas não bloqueiam",
  },
  linked: {
    label: "Relativa",
    icon: "📎",
    desc: "Contexto compartilhado — apenas referência",
  },
};

interface DemandSearchResult {
  id: string;
  title: string;
  workspace: string | null;
}

interface Props {
  demandId: string;
}

export function DemandDependenciesSection({ demandId }: Props) {
  const { user } = useAuth();
  const { data: rels } = useDemandRelationships(demandId);
  const { data: rows = [] } = useDemandRelationshipRows(demandId);
  const addRel = useAddRelationship();
  const removeRel = useRemoveRelationship();

  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<RelationshipType>("blocks");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery.trim(), 300);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["demand-search", debouncedQuery, demandId],
    enabled: debouncedQuery.length >= 3,
    staleTime: 5_000,
    queryFn: async (): Promise<DemandSearchResult[]> => {
      const { data, error } = await supabase
        .from("demands")
        .select("id, title, workspace")
        .ilike("title", `%${debouncedQuery}%`)
        .neq("id", demandId)
        .limit(8);
      if (error) throw error;
      return (data ?? []) as DemandSearchResult[];
    },
  });

  // Map id+direction → relationship row id (for delete button).
  const relIdLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const otherId = r.demand_id === demandId ? r.related_demand_id : r.demand_id;
      m.set(`${r.relationship_type}:${otherId}`, r.id);
    }
    return m;
  }, [rows, demandId]);

  const handleAdd = (relatedId: string) => {
    addRel.mutate(
      { demandId, relatedId, type: addType, createdBy: user?.id },
      {
        onSuccess: () => {
          setSearchQuery("");
          setShowAdd(false);
        },
      },
    );
  };

  const handleRemove = (otherId: string, type: RelationshipType) => {
    const id = relIdLookup.get(`${type}:${otherId}`);
    if (!id) return;
    removeRel.mutate({ id, demandId, relatedId: otherId });
  };

  const blockedBy = rels?.blocked_by ?? [];
  const blocksThese = rels?.blocks_these ?? [];
  const related = rels?.related ?? [];
  const isEmpty =
    blockedBy.length === 0 && blocksThese.length === 0 && related.length === 0;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dependências
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" /> Vincular
        </Button>
      </div>

      {isEmpty && !showAdd && (
        <p className="text-xs text-muted-foreground">Sem dependências</p>
      )}

      {blockedBy.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">
            Bloqueada por
          </p>
          <div className="space-y-1">
            {blockedBy.map((dep: DependencyItem) => (
              <DependencyChip
                key={dep.id}
                id={dep.id}
                title={dep.title}
                icon="🔒"
                tone="destructive"
                onRemove={() => handleRemove(dep.id, "blocks")}
              />
            ))}
          </div>
        </div>
      )}

      {blocksThese.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">
            Bloqueia
          </p>
          <div className="space-y-1">
            {blocksThese.map((dep: DependencyItem) => (
              <DependencyChip
                key={dep.id}
                id={dep.id}
                title={dep.title}
                icon="🔒"
                onRemove={() => handleRemove(dep.id, "blocks")}
              />
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">
            Relacionadas
          </p>
          <div className="space-y-1">
            {related.map((dep) => {
              const t: RelationshipType = dep.type ?? "related";
              return (
                <DependencyChip
                  key={`${t}-${dep.id}`}
                  id={dep.id}
                  title={dep.title}
                  icon={t === "related" ? "🔗" : "📎"}
                  onRemove={() => handleRemove(dep.id, t)}
                />
              );
            })}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(TYPE_CONFIG) as RelationshipType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAddType(type)}
                className={cn(
                  "text-[11px] px-2 py-1.5 rounded-md border text-left transition-all",
                  addType === type
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="block">
                  {TYPE_CONFIG[type].icon} {TYPE_CONFIG[type].label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {TYPE_CONFIG[addType].desc}
          </p>

          <div className="relative">
            <Input
              placeholder="Buscar demanda pelo título..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {searchResults.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleAdd(d.id)}
                    disabled={addRel.isPending}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left"
                  >
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
                        d.workspace === "tech"
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {d.workspace === "tech" ? "TECH" : "CX"}
                    </span>
                    <span className="truncate">{d.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setShowAdd(false);
                setSearchQuery("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
