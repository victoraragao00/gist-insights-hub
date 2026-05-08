import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// ── All RFIs (global list) ──
export interface AllRfisFilters {
  statusId?: string;
  clientId?: string;
  search?: string;
  workspace?: string;
}

const RFI_LIST_SELECT =
  "*, rfi_statuses(name, color), user_profiles!assignee_id(full_name, email), demands(id, title, workspace, client_id, clients(id, name)), projects(id, title, workspace, client_id, is_internal, clients(id, name))";

export function useAllRfis(filters: AllRfisFilters) {
  const { user } = useAuth();
  const { statusId, clientId, search, workspace } = filters;
  return useQuery({
    queryKey: ["all-rfis", user?.id, statusId ?? "all", clientId ?? "all", search ?? "", workspace ?? "all"],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("rfis")
        .select(RFI_LIST_SELECT)
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusId) query = query.eq("status_id", statusId);
      if (search && search.trim()) query = query.ilike("rfi_number", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;

      // Client-side filtering across both demand & project link sources
      let rows = data ?? [];
      if (clientId) {
        rows = rows.filter((r) => {
          const d = r.demands as { client_id?: string } | null;
          const p = r.projects as { client_id?: string } | null;
          return d?.client_id === clientId || p?.client_id === clientId;
        });
      }
      if (workspace) {
        rows = rows.filter((r) => {
          const d = r.demands as { workspace?: string } | null;
          const p = r.projects as { workspace?: string } | null;
          return d?.workspace === workspace || p?.workspace === workspace;
        });
      }
      return rows;
    },
  });
}

// ── Queries ──

export function useRfiByDemand(demandId: string) {
  return useQuery({
    queryKey: ["rfi", demandId],
    staleTime: 30_000,
    enabled: !!demandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfis")
        .select("*, rfi_statuses(name, color), user_profiles!assignee_id(full_name, email)")
        .eq("demand_id", demandId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRfisByProject(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rfis", "project", projectId, user?.id],
    staleTime: 30_000,
    enabled: !!projectId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfis")
        .select("*, rfi_statuses(name, color), user_profiles!assignee_id(full_name, email)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRfisByClient(clientId: string) {
  return useQuery({
    queryKey: ["rfis", "client", clientId],
    staleTime: 30_000,
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfis")
        .select("*, rfi_statuses(name, color), user_profiles!assignee_id(full_name, email), demands!inner(title, client_id)")
        .eq("demands.client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRfiStatuses() {
  return useQuery({
    queryKey: ["rfi_statuses", "active"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfi_statuses")
        .select("*")
        .eq("active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllRfiStatuses() {
  return useQuery({
    queryKey: ["rfi_statuses", "all"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfi_statuses")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Mutations ──

interface CreateRfiInput {
  demand_id?: string | null;
  project_id?: string | null;
  status_id?: string;
}

export function useCreateRfi() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRfiInput) => {
      if (!input.demand_id && !input.project_id) {
        throw new Error("RFI precisa estar vinculada a uma demanda ou projeto");
      }
      if (input.demand_id && input.project_id) {
        throw new Error("RFI não pode estar vinculada a demanda E projeto ao mesmo tempo");
      }
      const insertData = {
        demand_id: input.demand_id ?? null,
        project_id: input.project_id ?? null,
        status_id: input.status_id ?? null,
        created_by: user?.id ?? "",
        rfi_number: "", // overwritten by trigger
        rfi_seq_number: 0, // overwritten by trigger
      };
      const { data, error } = await supabase
        .from("rfis")
        .insert(insertData as typeof insertData & { rfi_number: string; rfi_seq_number: number })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      if (variables.demand_id) queryClient.invalidateQueries({ queryKey: ["rfi", variables.demand_id] });
      if (variables.project_id) queryClient.invalidateQueries({ queryKey: ["rfis", "project", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["rfis"] });
      queryClient.invalidateQueries({ queryKey: ["all-rfis"] });
      toast.success("RFI criada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar RFI"),
  });
}

export function useUpdateRfi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; demandId?: string; projectId?: string; fields: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("rfis")
        .update({ ...input.fields, updated_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.demandId) queryClient.invalidateQueries({ queryKey: ["rfi", variables.demandId] });
      if (variables.projectId) queryClient.invalidateQueries({ queryKey: ["rfis", "project", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["rfis"] });
      queryClient.invalidateQueries({ queryKey: ["all-rfis"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar RFI"),
  });
}

export function useDeleteRfi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; demandId?: string; projectId?: string }) => {
      const { error } = await supabase.from("rfis").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.demandId) queryClient.invalidateQueries({ queryKey: ["rfi", variables.demandId] });
      if (variables.projectId) queryClient.invalidateQueries({ queryKey: ["rfis", "project", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["rfis"] });
      queryClient.invalidateQueries({ queryKey: ["all-rfis"] });
      toast.success("RFI excluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir RFI"),
  });
}

// ── Status CRUD (admin) ──

export function useManageRfiStatuses() {
  const queryClient = useQueryClient();

  const createStatus = useMutation({
    mutationFn: async (input: { name: string; color?: string; position: number }) => {
      const { error } = await supabase.from("rfi_statuses").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi_statuses"] });
      toast.success("Status criado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao criar status"),
  });

  const updateStatus = useMutation({
    mutationFn: async (input: { id: string; fields: Record<string, unknown> }) => {
      const { error } = await supabase.from("rfi_statuses").update(input.fields).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi_statuses"] });
      toast.success("Status atualizado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar status"),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rfi_statuses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi_statuses"] });
      toast.success("Status excluído");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao excluir status"),
  });

  return { createStatus, updateStatus, deleteStatus };
}
