import { useState, useCallback, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";

const SESSION_PREFIX = "kanban_col_collapsed_";

type Column = Pick<Tables<"ticket_columns">, "id" | "triggers_finished_at">;

function getInitialCollapsed(columnId: string, isFinished: boolean): boolean {
  try {
    const saved = sessionStorage.getItem(SESSION_PREFIX + columnId);
    if (saved !== null) return saved === "true";
  } catch {
    // sessionStorage may be unavailable
  }
  return isFinished;
}

function buildState(columns: Column[]): Record<string, boolean> {
  return Object.fromEntries(
    columns.map((c) => [c.id, getInitialCollapsed(c.id, !!c.triggers_finished_at)])
  );
}

export function useCollapsedColumns(columns: Column[]) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    buildState(columns)
  );

  // Reconcile when columns list changes — preserve existing keys, seed new ones
  useEffect(() => {
    setCollapsed((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const col of columns) {
        if (!(col.id in next)) {
          next[col.id] = getInitialCollapsed(col.id, !!col.triggers_finished_at);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns]);

  const toggle = useCallback((columnId: string) => {
    setCollapsed((prev) => {
      const nextValue = !prev[columnId];
      try {
        sessionStorage.setItem(SESSION_PREFIX + columnId, String(nextValue));
      } catch {
        // ignore
      }
      return { ...prev, [columnId]: nextValue };
    });
  }, []);

  const isCollapsed = useCallback(
    (columnId: string) => !!collapsed[columnId],
    [collapsed]
  );

  return { isCollapsed, toggle };
}
