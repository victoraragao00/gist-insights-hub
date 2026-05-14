import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuditAlerts } from "@/hooks/useAuditAlerts";
import { useUserRole } from "@/hooks/useUserRole";
import { AlertsTab } from "@/components/audits/AlertsTab";
import { RulesTab } from "@/components/audits/RulesTab";

const Audits = () => {
  const { isAdmin } = useUserRole();
  const { data: summary, isLoading, isError, refetch } = useAuditAlerts();

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
          <p className="text-muted-foreground">
            Alertas automáticos baseados nos seus indicadores (Fase 6)
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 animate-shimmer" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 animate-shimmer" />
                <Skeleton className="h-3 w-20 mt-1 animate-shimmer" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
          <p className="text-muted-foreground">
            Alertas automáticos baseados nos seus indicadores (Fase 6)
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar alertas</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados. Tente novamente.
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalAlerts = summary?.total_alerts_30d ?? 0;
  const unreadCount = summary?.unread_count ?? 0;
  const alerts = summary?.alerts ?? [];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
        <p className="text-muted-foreground">
          Alertas automáticos baseados nos seus indicadores (Fase 6)
        </p>
      </div>

      <Tabs defaultValue="alertas">
        <TabsList>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>

        <TabsContent value="alertas" className="space-y-6">
          <AlertsTab totalAlerts={totalAlerts} unreadCount={unreadCount} alerts={alerts} />
        </TabsContent>

        <TabsContent value="regras" className="space-y-6">
          <RulesTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Audits;
