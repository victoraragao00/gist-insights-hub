import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { DemandFilters } from "@/hooks/useDemands";

function escapeCsvField(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm");
  } catch {
    return dateStr;
  }
}

export function useExportDemandsCSV() {
  return useMutation({
    mutationFn: async (filters: DemandFilters) => {
      let query = supabase
        .from("demands")
        .select(`
          id,
          title,
          priority,
          created_at,
          started_at,
          finished_at,
          demand_types!inner(name),
          ticket_columns!inner(name),
          demand_areas(name),
          user_profiles!assignee_id(full_name, email),
          clients!inner(name)
        `)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (filters.client_id && filters.client_id !== "all") {
        query = query.eq("client_id", filters.client_id);
      }
      if (filters.demand_type_id && filters.demand_type_id !== "all") {
        query = query.eq("demand_type_id", filters.demand_type_id);
      }
      if (filters.priority && filters.priority !== ("all" as string)) {
        query = query.eq("priority", filters.priority);
      }
      if (filters.area_id && filters.area_id !== "all") {
        query = query.eq("area_id", filters.area_id);
      }
      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const PRIORITY_LABEL: Record<string, string> = {
        urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa",
      };

      const headers = [
        "ID", "Título", "Tipo", "Prioridade", "Coluna", "Área",
        "Responsável", "Cliente", "Criação", "Início", "Conclusão",
      ];

      const rows = (data ?? []).map((d) => {
        const demand = d as {
          id: string;
          title: string;
          priority: string;
          created_at: string | null;
          started_at: string | null;
          finished_at: string | null;
          demand_types: { name: string } | null;
          ticket_columns: { name: string } | null;
          demand_areas: { name: string } | null;
          user_profiles: { full_name: string | null; email: string | null } | null;
          clients: { name: string } | null;
        };
        return [
          escapeCsvField(demand.id),
          escapeCsvField(demand.title),
          escapeCsvField(demand.demand_types?.name),
          escapeCsvField(PRIORITY_LABEL[demand.priority] ?? demand.priority),
          escapeCsvField(demand.ticket_columns?.name),
          escapeCsvField(demand.demand_areas?.name),
          escapeCsvField(demand.demand_assignees?.name),
          escapeCsvField(demand.clients?.name),
          escapeCsvField(formatDateSafe(demand.created_at)),
          escapeCsvField(formatDateSafe(demand.started_at)),
          escapeCsvField(formatDateSafe(demand.finished_at)),
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `demandas_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return (data ?? []).length;
    },
    onSuccess: (count) => {
      toast.success(`CSV exportado com ${count} demandas`);
    },
    onError: (err) => {
      toast.error("Erro ao exportar: " + (err instanceof Error ? err.message : "Erro"));
    },
  });
}
