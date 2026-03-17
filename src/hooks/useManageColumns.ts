import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddColumnInput {
  name: string;
  position: number;
  color?: string;
}

interface RenameColumnInput {
  id: string;
  name: string;
}

interface ReorderColumnsInput {
  updates: { id: string; position: number }[];
}

interface DeleteColumnInput {
  id: string;
  moveTicketsTo?: string; // target column_id if column has tickets
}

export interface ColumnHasTicketsError {
  code: "COLUMN_HAS_TICKETS";
  count: number;
}

export function useAddColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddColumnInput) => {
      const { error } = await supabase.from("ticket_columns").insert({
        name: input.name,
        position: input.position,
        color: input.color ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket_columns"] });
      toast.success("Coluna adicionada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao adicionar coluna"),
  });
}

export function useRenameColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RenameColumnInput) => {
      const { error } = await supabase
        .from("ticket_columns")
        .update({ name: input.name })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket_columns"] });
      toast.success("Coluna renomeada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao renomear coluna"),
  });
}

export function useReorderColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReorderColumnsInput) => {
      for (const u of input.updates) {
        const { error } = await supabase
          .from("ticket_columns")
          .update({ position: u.position })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket_columns"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao reordenar colunas"),
  });
}

export function useDeleteColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteColumnInput) => {
      // Check ticket count
      const { count, error: countErr } = await supabase
        .from("demands")
        .select("id", { count: "exact", head: true })
        .eq("column_id", input.id);
      if (countErr) throw countErr;

      if ((count ?? 0) > 0 && !input.moveTicketsTo) {
        const err: ColumnHasTicketsError = { code: "COLUMN_HAS_TICKETS", count: count ?? 0 };
        throw err;
      }

      // Move tickets if needed
      if (input.moveTicketsTo && (count ?? 0) > 0) {
        const { error: moveErr } = await supabase
          .from("demands")
          .update({ column_id: input.moveTicketsTo })
          .eq("column_id", input.id);
        if (moveErr) throw moveErr;
      }

      const { error } = await supabase
        .from("ticket_columns")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket_columns"] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
      toast.success("Coluna excluída");
    },
    onError: (err) => {
      if (typeof err === "object" && err !== null && "code" in err && (err as unknown as ColumnHasTicketsError).code === "COLUMN_HAS_TICKETS") {
        // Let caller handle this
        throw err;
      }
      toast.error(err instanceof Error ? err.message : "Erro ao excluir coluna");
    },
  });
}
