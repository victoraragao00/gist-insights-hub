import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShieldAlert, Bell, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KPICard } from "@/components/KPICard";

const METRIC_LABELS: Record<string, string> = {
  score_prioridade: "Score",
  tom_critico_pct: "% Crítico",
  volume_periodo: "Volume",
};

interface AlertItem {
  id: string;
  client_name: string;
  metric: string;
  metric_value: number;
  message: string;
  read: boolean;
  created_at: string;
}

interface AlertsTabProps {
  totalAlerts: number;
  unreadCount: number;
  alerts: AlertItem[];
}

export function AlertsTab({ totalAlerts, unreadCount, alerts }: AlertsTabProps) {
  return (
    <div className="space-y-6">
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
}
