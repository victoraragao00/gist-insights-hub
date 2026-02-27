import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug, BarChart3, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão centralizada de todas as suas integrações e indicadores
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/integrations")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Integrações Ativas</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                <Plug className="h-4 w-4 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Conecte suas plataformas</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/indicators")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Indicadores</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                <BarChart3 className="h-4 w-4 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Crie KPIs customizados</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/audits")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Auditorias Ativas</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                <ShieldAlert className="h-4 w-4 text-accent-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Alertas automáticos</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Comece conectando suas plataformas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Conecte Stripe, Linear, Notion, WhatsApp, Slack e outras plataformas para centralizar seus dados, criar indicadores e configurar alertas automáticos.
            </p>
            <Button onClick={() => navigate("/integrations")}>
              Ver Integrações <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Index;
