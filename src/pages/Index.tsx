import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, Megaphone, TrendingUp } from "lucide-react";

const stats = [
  { label: "Conversas Abertas", value: "—", icon: MessageSquare, change: "" },
  { label: "Total de Contatos", value: "—", icon: Users, change: "" },
  { label: "Campanhas Ativas", value: "—", icon: Megaphone, change: "" },
  { label: "Taxa de Resposta", value: "—", icon: TrendingUp, change: "" },
];

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas integrações Gist</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                  <stat.icon className="h-4 w-4 text-accent-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                {stat.change && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Conecte sua API</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Configure sua API Key do Gist nas{" "}
              <a href="/settings" className="text-primary font-medium hover:underline">
                Configurações
              </a>{" "}
              para começar a visualizar seus dados.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Index;
