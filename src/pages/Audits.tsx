import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KPICard } from "@/components/KPICard";
import { useAuditAlerts } from "@/hooks/useAuditAlerts";
import { AlertCircle } from "lucide-react";

const METRIC_LABELS: Record<string, string> = {
  score_prioridade: "Score",
  tom_critico_pct: "% Crítico",
  volume_periodo: "Volume",
};

const Audits = () => {
  const { data: summary, isLoading, isError, refetch } = useAuditAlerts();

  if (isLoading) {
    return (
      <div className="space-y-6">
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
        <div className="rounded-xl border border-border bg-card">
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-32 animate-shimmer" />
                <Skeleton className="h-5 w-24 animate-shimmer" />
                <Skeleton className="h-5 w-16 animate-shimmer" />
                <Skeleton className="h-5 flex-1 animate-shimmer" />
                <Skeleton className="h-5 w-20 animate-shimmer" />
                <Skeleton className="h-5 w-24 animate-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
        <p className="text-muted-foreground">
          Alertas automáticos baseados nos seus indicadores (Fase 6)
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
          <KPICard
            title="Total de alertas (30d)"
            value={String(totalAlerts)}
            subtitle="últimos 30 dias"
            icon={ShieldAlert}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <KPICard
            title="Não lidos"
            value={String(unreadCount)}
            subtitle={unreadCount > 0 ? "requerem atenção" : "todos lidos"}
            icon={Bell}
          />
        </div>
        {unreadCount > 0 && (
          <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <Badge variant="destructive" className="text-sm py-1 px-2">
              {unreadCount} não lido{unreadCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}
      </div>

      {alerts.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhum alerta nos últimos 30 dias</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              Quando houver alertas baseados nas suas regras de auditoria, eles aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert, i) => (
                <TableRow
                  key={alert.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }}
                >
                  <TableCell className="font-medium text-sm">{alert.client_name}</TableCell>
                  <TableCell className="text-sm">
                    {METRIC_LABELS[alert.metric] ?? alert.metric}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {Number(alert.metric_value).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <span title={alert.message}>
                      {alert.message.length > 80 ? `${alert.message.slice(0, 80)}…` : alert.message}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.created_at), { locale: ptBR, addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs border-0 ${
                        alert.read
                          ? "bg-muted text-muted-foreground"
                          : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                      }`}
                    >
                      {alert.read ? "Lido" : "Não lido"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Audits;
