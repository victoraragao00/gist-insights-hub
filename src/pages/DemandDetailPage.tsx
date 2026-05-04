import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDemand } from "@/hooks/useDemands";
import { DemandHeader } from "@/components/demands/detail/DemandHeader";
import { DemandSidebar } from "@/components/demands/detail/DemandSidebar";
import { DemandContentTab } from "@/components/demands/detail/DemandContentTab";
import { DemandConversationsTab } from "@/components/demands/detail/DemandConversationsTab";
import { DemandActivityTab } from "@/components/demands/detail/DemandActivityTab";

type TabValue = "content" | "conversations" | "activity";

const DemandDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: demand, isLoading, isError } = useDemand(id);
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <DemandHeader demand={demand} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main panel — Tabs */}
        <main className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="mb-4">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="conversations">Conversas</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-0">
              <DemandContentTab demand={demand} />
            </TabsContent>

            <TabsContent value="conversations" className="mt-0">
              <DemandConversationsTab demand={demand} />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <DemandActivityTab demandId={demand.id} />
            </TabsContent>
          </Tabs>
        </main>

        {/* Right sidebar */}
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
