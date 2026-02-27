import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3 } from "lucide-react";

const Indicators = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Indicadores</h1>
            <p className="text-muted-foreground">
              Crie KPIs customizados a partir das suas integrações
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Novo Indicador
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent mb-4">
              <BarChart3 className="h-8 w-8 text-accent-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Nenhum indicador criado</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Conecte uma integração primeiro, depois crie indicadores como MRR, conversas abertas, issues pendentes e muito mais.
            </p>
            <Button className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Criar primeiro indicador
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Indicators;
