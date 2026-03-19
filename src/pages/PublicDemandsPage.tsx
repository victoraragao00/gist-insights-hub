import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePublicDemands } from "@/hooks/usePublicDemands";
import type { PublicDemand } from "@/hooks/usePublicDemands";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import umodeLogo from "@/assets/umode-logo-full.png";

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgente", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
  high: { label: "Alta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  medium: { label: "Média", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  low: { label: "Baixa", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
};

function KPICard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-1 shadow-sm">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

const PublicDemandsPage = () => {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = usePublicDemands(token);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const demands = data?.demands ?? [];

  const uniqueTypes = useMemo(
    () => Array.from(new Set(demands.map((d) => d.type))).filter(Boolean),
    [demands]
  );

  const filtered = useMemo(() => {
    return demands.filter((d: PublicDemand) => {
      if (filterStatus === "open" && d.finished_at !== null) return false;
      if (filterStatus === "completed" && d.finished_at === null) return false;
      if (filterStatus === "blocked" && !d.is_blocked) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      return true;
    });
  }, [demands, filterStatus, filterType]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data || (data as { error?: string }).error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <img src={umodeLogo} alt="uMode" className="h-8 opacity-60" />
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-gray-700">Link inválido ou expirado</h1>
          <p className="text-sm text-gray-500">
            Este link de central de demandas não é válido ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  const clientName = data.client?.name ?? "Cliente";
  const totals = data.totals;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={umodeLogo} alt="uMode" className="h-7" />
            <div className="h-5 w-px bg-gray-200" />
            <span className="text-sm font-semibold text-gray-700">{clientName}</span>
          </div>
          <span className="text-xs text-gray-400">Central de Demandas</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total" value={totals.total} />
          <KPICard label="Abertos" value={totals.open} />
          <KPICard label="Concluídos" value={totals.completed} />
          <KPICard label="Bloqueados" value={totals.blocked} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-40 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-40 bg-white">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {uniqueTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} de {demands.length} tickets
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              Nenhuma demanda encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Título</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Prioridade</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Área</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Responsável</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Abertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: PublicDemand) => {
                  const priorityCfg = PRIORITY_CONFIG[d.priority] ?? PRIORITY_CONFIG.medium;
                  const statusLabel = d.is_blocked
                    ? "Bloqueado"
                    : d.finished_at
                    ? "Concluído"
                    : "Aberto";
                  const statusClass = d.is_blocked
                    ? "bg-red-50 text-red-600"
                    : d.finished_at
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-blue-50 text-blue-600";

                  return (
                    <TableRow key={d.id} className="hover:bg-gray-50/50">
                      <TableCell className="text-sm font-medium text-gray-800 max-w-xs">
                        <span className="line-clamp-2">{d.title}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{d.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs border-0 ${priorityCfg.className}`}
                        >
                          {priorityCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{d.area ?? "—"}</TableCell>
                      <TableCell className="text-sm text-gray-500">{d.assignee ?? "—"}</TableCell>
                      <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 text-center">
        <p className="text-xs text-gray-400">
          Central de Demandas — uMode Tecnologia
        </p>
      </footer>
    </div>
  );
};

export default PublicDemandsPage;
