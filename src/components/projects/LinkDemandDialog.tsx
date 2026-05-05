import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  useUnassignedDemands,
  useLinkDemandToProject,
} from "@/hooks/useProjects";
import { useDebounce } from "@/hooks/useDebounce";

interface LinkDemandDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkDemandDialog({
  projectId,
  open,
  onOpenChange,
}: LinkDemandDialogProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const { data: demands = [], isLoading } = useUnassignedDemands(debouncedQuery);
  const link = useLinkDemandToProject();

  const handleLink = async (demandId: string) => {
    await link.mutateAsync({ demandId, projectId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular demanda ao projeto</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar demanda sem projeto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-96 overflow-y-auto -mx-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Carregando...
            </p>
          ) : demands.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Nenhuma demanda disponível.
            </p>
          ) : (
            demands.map((d) => (
              <button
                key={d.id}
                onClick={() => handleLink(d.id)}
                disabled={link.isPending}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {d.demand_types && <span>{d.demand_types.name}</span>}
                    {d.ticket_columns && (
                      <span>· {d.ticket_columns.name}</span>
                    )}
                    {d.clients && <span>· {d.clients.name}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
