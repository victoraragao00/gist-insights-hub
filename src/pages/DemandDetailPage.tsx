import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDemand } from "@/hooks/useDemands";
import { useDemandTaskStats } from "@/hooks/useDemandTasks";
import { DemandHeader } from "@/components/demands/detail/DemandHeader";
import { DemandSidebar } from "@/components/demands/detail/DemandSidebar";
import { DemandContentTab } from "@/components/demands/detail/DemandContentTab";
import { DemandTasksSection } from "@/components/demands/detail/DemandTasksSection";
import { DemandConversationsTab } from "@/components/demands/detail/DemandConversationsTab";
import { DemandActivityTab } from "@/components/demands/detail/DemandActivityTab";

type TabValue = "content" | "tasks" | "conversations" | "activity";

const DemandDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: demand, isLoading, isError } = useDemand(id);
  const { data: stats } = useDemandTaskStats(demand?.id);
  const [activeTab, setActiveTab] = useState<TabValue>("content");

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

  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const allDone = total > 0 && done === total;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <DemandHeader demand={demand} />

      <div className="flex flex-col lg:flex-row gap-6">
        <main className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="mb-4">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="tasks">
                <span className={cn("flex items-center gap-1", allDone && "text-emerald-600 dark:text-emerald-400")}>
                  Subdemandas
                  {total > 0 && !allDone && <span className="text-muted-foreground">({total})</span>}
                  {allDone && <Check className="h-3.5 w-3.5" />}
                </span>
              </TabsTrigger>
              <TabsTrigger value="conversations">Conversas</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-0">
              <DemandContentTab demand={demand} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0">
              <DemandTasksSection demandId={demand.id} />
            </TabsContent>

            <TabsContent value="conversations" className="mt-0">
              <DemandConversationsTab demand={demand} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <DemandActivityTab demandId={demand.id} />
            </TabsContent>
          </Tabs>
        </main>

        <DemandSidebar
          demand={demand}
          onActivityTabSelect={() => setActiveTab("activity")}
          onClose={() => navigate("/demands")}
        />
      </div>
    </div>
  );
};

export default DemandDetailPage;
