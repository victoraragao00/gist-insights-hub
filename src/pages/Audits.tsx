import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ShieldAlert } from "lucide-react";

const Audits = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
            <p className="text-muted-foreground">
              Configure alertas automáticos baseados nos seus indicadores
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Nova Auditoria
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent mb-4">
              <ShieldAlert className="h-8 w-8 text-accent-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Nenhuma auditoria configurada</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Crie regras de alerta para ser notificado via WhatsApp, Email ou Slack quando seus indicadores atingirem condições específicas.
            </p>
            <Button className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Criar primeira auditoria
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Audits;
