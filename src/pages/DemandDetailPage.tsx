import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemand } from "@/hooks/useDemands";
import { DemandDetailContent } from "@/components/demands/DemandDetailSheet";

const DemandDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: demand, isLoading, isError } = useDemand(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !demand) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-medium">Demanda não encontrada</p>
        <Button variant="link" onClick={() => navigate("/demands")} className="mt-2">
          Voltar para Demandas
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/demands")}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> Demandas
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card p-6">
        <DemandDetailContent demand={demand} onClose={() => navigate("/demands")} />
      </div>
    </div>
  );
};

export default DemandDetailPage;
