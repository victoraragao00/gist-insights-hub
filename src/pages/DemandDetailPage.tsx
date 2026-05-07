import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";

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
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <DemandHeader demand={demand} />
          <main className="min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="mb-4">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="tasks">
                <span className="flex items-center gap-1.5">
                  Subdemandas
                  {total > 0 && !allDone && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {done}/{total}
                    </span>
                  )}
                  {allDone && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-medium inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Tudo pronto
                    </span>
                  )}
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
        </div>
      </div>

      <aside className="hidden lg:block w-[300px] shrink-0 border-l border-border overflow-y-auto">
        <div className="p-6">
          <DemandSidebar
            demand={demand}
            onActivityTabSelect={() => setActiveTab("activity")}
            onClose={() => navigate("/demands")}
          />
        </div>
      </aside>
    </div>
  );
};

export default DemandDetailPage;
