import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { ProjectStatsData } from "@/lib/projectStatus";

export interface UserMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface ClientMini {
  id: string;
  name: string;
}

export interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  due_date: string | null;
  original_due_date: string | null;
  hours_estimated: number | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  workspace: string;
  client_id: string | null;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  user_profiles: UserMini | null;
  clients: ClientMini | null;
}

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  added_at: string;
  user_profiles: UserMini | null;
}

export interface ProjectDemandRow {
  id: string;
  title: string;
  priority: string;
  column_id: string;
  project_id: string | null;
  created_at: string;
  finished_at: string | null;
  cancellation_reason: string | null;
  is_blocked: boolean | null;
  client_id: string;
  demand_types: { name: string; color: string | null } | null;
  ticket_columns: {
    name: string;
    color: string | null;
    triggers_finished_at: boolean | null;
  } | null;
  user_profiles: UserMini | null;
  clients?: ClientMini | null;
}

const PROJECT_SELECT = `
  id, title, description, owner_id, due_date, original_due_date, hours_estimated,
  cancelled_at, cancelled_by, workspace, client_id, is_internal, created_at, updated_at,
  user_profiles!projects_owner_id_fkey(id, full_name, email),
  clients(id, name)
`;

export function useProjects(_workspace?: string) {
  const { user } = useAuth();
  return useQuery<ProjectRow[]>({
    queryKey: ["projects", user?.id, "all"],
    enabled: !!user?.id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
  });
}

export function useProject(id: string | undefined) {
  const { user } = useAuth();
  return useQuery<ProjectRow | null>({
    queryKey: ["project", id, user?.id],
    enabled: !!id && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ProjectRow | null;
    },
  });
}

export function useProjectStats(id: string | undefined) {
  const { user } = useAuth();
  return useQuery<ProjectStatsData | null>({
    queryKey: ["project_stats", id, user?.id],
    enabled: !!id && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_stats", {
        p_project_id: id!,
      });
      if (error) throw error;
      return (data ?? null) as unknown as ProjectStatsData | null;
    },
  });
}

export function useProjectMembers(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery<ProjectMemberRow[]>({
    queryKey: ["project_members", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select(
          "id, project_id, user_id, role, added_at, user_profiles!project_members_user_id_fkey(id, full_name, email)",
        )
        .eq("project_id", projectId!)
        .order("added_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectMemberRow[];
    },
  });
}

const DEMAND_SELECT = `
  id, title, priority, column_id, project_id, created_at, finished_at,
  cancellation_reason, is_blocked, client_id,
  demand_types(name, color),
  ticket_columns(name, color, triggers_finished_at),
  user_profiles!demands_assignee_id_user_profiles_fkey(id, full_name, email),
  clients(id, name)
`;

export function useProjectDemands(projectId: string | undefined) {
  const { user } = useAuth();
  return useQuery<ProjectDemandRow[]>({
    queryKey: ["project_demands", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demands")
        .select(DEMAND_SELECT)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectDemandRow[];
    },
  });
}

export function useUnassignedDemands(query: string) {
  const { user } = useAuth();
  return useQuery<ProjectDemandRow[]>({
    queryKey: ["unassigned_demands", user?.id, query],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("demands")
        .select(DEMAND_SELECT)
        .is("project_id", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ProjectDemandRow[];
    },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────

interface CreateProjectInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
  client_id?: string | null;
  workspace?: string;
  is_internal?: boolean;
}

export function useCreateProject() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { data: created, error } = await supabase.rpc("create_project", {
        p_title: input.title,
        p_description: input.description ?? null,
        p_due_date: input.due_date ?? null,
        p_client_id: input.is_internal ? null : (input.client_id ?? null),
        p_workspace: input.workspace ?? "tech",
      });
      if (error) throw error;
      const newId = created && typeof created === "object" && "id" in created
        ? (created as { id: string }).id
        : (created as unknown as string | null);
      if (input.is_internal && newId) {
        const { error: updErr } = await supabase
          .from("projects")
          .update({ is_internal: true })
          .eq("id", newId);
        if (updErr) throw updErr;
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Projeto criado");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

interface UpdateProjectInput {
  id: string;
  fields: Partial<{
    title: string;
    description: string | null;
    due_date: string | null;
    client_id: string | null;
  }>;
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: UpdateProjectInput) => {
      const { error } = await supabase
        .from("projects")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Projeto atualizado");
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUpdateProjectDueDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      newDate,
      currentDueDate,
      originalDueDate,
    }: {
      projectId: string;
      newDate: string | null;
      currentDueDate: string | null;
      originalDueDate: string | null;
    }) => {
      const updates: Record<string, unknown> = { due_date: newDate };
      if (!originalDueDate && currentDueDate) {
        updates.original_due_date = currentDueDate;
      }
      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Data de entrega atualizada");
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => toast.error("Erro ao atualizar data: " + err.message),
  });
}

export function useCancelProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase.rpc("cancel_project", {
        p_project_id: id,
        p_reason: reason ?? "Projeto cancelado",
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Projeto cancelado");
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_stats", vars.id] });
      qc.invalidateQueries({ queryKey: ["project_demands", vars.id] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
      role = "member",
    }: {
      projectId: string;
      userId: string;
      role?: string;
    }) => {
      const { error } = await supabase
        .from("project_members")
        .upsert(
          { project_id: projectId, user_id: userId, role },
          { onConflict: "project_id,user_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Membro adicionado");
      qc.invalidateQueries({ queryKey: ["project_members", vars.projectId] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
    }: {
      projectId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["project_members", vars.projectId] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useLinkDemandToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demandId,
      projectId,
    }: {
      demandId: string;
      projectId: string;
    }) => {
      const { error } = await supabase
        .from("demands")
        .update({ project_id: projectId })
        .eq("id", demandId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Demanda vinculada");
      qc.invalidateQueries({ queryKey: ["project_demands", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project_stats", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["unassigned_demands"] });
      qc.invalidateQueries({ queryKey: ["demand", vars.demandId] });
      qc.invalidateQueries({ queryKey: ["demands"] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}

export function useUnlinkDemandFromProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demandId,
      projectId,
    }: {
      demandId: string;
      projectId?: string | null;
    }) => {
      const { error } = await supabase
        .from("demands")
        .update({ project_id: null })
        .eq("id", demandId);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (_d, vars) => {
      toast.success("Demanda desvinculada");
      if (vars.projectId) {
        qc.invalidateQueries({ queryKey: ["project_demands", vars.projectId] });
        qc.invalidateQueries({ queryKey: ["project_stats", vars.projectId] });
      }
      qc.invalidateQueries({ queryKey: ["unassigned_demands"] });
      qc.invalidateQueries({ queryKey: ["demand", vars.demandId] });
      qc.invalidateQueries({ queryKey: ["demands"] });
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });
}
