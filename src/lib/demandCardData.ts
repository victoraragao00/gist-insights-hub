import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getAgingDays, getAgingStyle, type AgingStyle } from "./getAgingStyle";
import type { DemandRow } from "@/hooks/useDemands";

function getInitials(name: string | null | undefined): string | null {
  if (!name) return null;
  const clean = name.includes("@") ? name.split("@")[0] : name;
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export interface DemandCardData {
  aging: AgingStyle | null;
  taskCount?: { total: number; done: number };
  totalHours: number;
  createdAgo: string;
  isBlocked: boolean;
  clientName?: string;
  typeName?: string;
  typeColor?: string | null;
  areaName?: string;
  areaColor?: string | null;
  assigneeName?: string;
  assigneeInitials: string | null;
}

export function getDemandCardData(
  demand: DemandRow,
  taskCounts?: Record<string, { total: number; done: number }>,
  hoursTotals?: Record<string, number>,
): DemandCardData {
  const aging = getAgingStyle(getAgingDays(demand));
  const taskCount = taskCounts?.[demand.id];
  const totalHours = hoursTotals?.[demand.id] ?? demand.total_hours ?? 0;
  const createdAgo = demand.created_at
    ? formatDistanceToNow(new Date(demand.created_at), { locale: ptBR, addSuffix: false })
    : "";

  const fullName = demand.user_profiles?.full_name ?? null;
  const email = demand.user_profiles?.email ?? null;
  const assigneeName =
    fullName?.split(" ")[0] ?? email?.split("@")[0] ?? undefined;

  return {
    aging,
    taskCount,
    totalHours,
    createdAgo,
    isBlocked: !!demand.is_blocked,
    clientName: demand.clients?.name,
    typeName: demand.demand_types?.name,
    typeColor: demand.demand_types?.color ?? null,
    areaName: demand.demand_areas?.name,
    areaColor: demand.demand_areas?.color ?? null,
    assigneeName,
    assigneeInitials: getInitials(fullName ?? email),
  };
}
