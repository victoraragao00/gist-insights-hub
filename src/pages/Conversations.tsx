import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

const Conversations = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversas</h1>
          <p className="text-muted-foreground">Acompanhe o volume e status das conversas</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
                <MessageSquare className="h-4 w-4 text-accent-foreground" />
              </div>
              Visão Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Configure sua API Key nas Configurações para visualizar os dados de conversas.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Conversations;
