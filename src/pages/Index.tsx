import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  MessageSquare,
  MessageSquareOff,
  Tags,
  UserCheck,
  Layers,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useGistKPIs } from "@/hooks/useGistKPIs";

const Index = () => {
  const navigate = useNavigate();
  const { data: kpis, isLoading, isError } = useGistKPIs();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              KPIs em tempo real da sua integração Gist
            </p>
          </div>
          {isError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Erro ao conectar com Gist
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <KPICard
            title="Total de Contatos"
            value={kpis?.totalContacts ?? 0}
            subtitle="Contatos cadastrados no Gist"
            icon={Users}
            isLoading={isLoading}
          />
          <KPICard
            title="Conversas Abertas"
            value={kpis?.openConversations ?? 0}
            subtitle="Aguardando resposta"
            icon={MessageSquare}
            isLoading={isLoading}
          />
          <KPICard
            title="Conversas Fechadas"
            value={kpis?.closedConversations ?? 0}
            subtitle="Resolvidas"
            icon={MessageSquareOff}
            isLoading={isLoading}
          />
          <KPICard
            title="Tags"
            value={kpis?.totalTags ?? 0}
            subtitle="Tags de organização"
            icon={Tags}
            isLoading={isLoading}
          />
          <KPICard
            title="Teammates Online"
            value={kpis ? `${kpis.teammatesOnline}/${kpis.totalTeammates}` : "0"}
            subtitle="Ativos agora"
            icon={UserCheck}
            isLoading={isLoading}
          />
          <KPICard
            title="Segmentos Ativos"
            value={kpis?.activeSegments ?? 0}
            subtitle="Segmentos de audiência"
            icon={Layers}
            isLoading={isLoading}
          />
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Próximos passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              Crie indicadores customizados, configure alertas automáticos ou conecte novas plataformas.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => navigate("/indicators")}>
                Indicadores <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/audits")}>
                Auditorias <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={() => navigate("/integrations")}>
                Integrações <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Index;
