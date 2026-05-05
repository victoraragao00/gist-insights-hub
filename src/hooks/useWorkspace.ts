import { useEffect, useState } from "react";
import { useUserProfile, type DefaultWorkspace } from "./useUserProfile";

export type Workspace = "cx" | "tech";

const SESSION_KEY = "cx_hub_active_workspace";

function readSession(): Workspace | null {
  if (typeof window === "undefined") return null;
  const saved = window.sessionStorage.getItem(SESSION_KEY);
  return saved === "cx" || saved === "tech" ? saved : null;
}

export function useWorkspace(): {
  activeWorkspace: Workspace;
  setWorkspace: (ws: Workspace) => void;
  defaultWorkspace: DefaultWorkspace;
} {
  const { profile } = useUserProfile();

  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(
    () => readSession() ?? "cx",
  );

  useEffect(() => {
    if (!profile?.default_workspace) return;
    if (readSession()) return;
    const def: Workspace =
      profile.default_workspace === "tech" ? "tech" : "cx";
    setActiveWorkspace(def);
    window.sessionStorage.setItem(SESSION_KEY, def);
  }, [profile?.default_workspace]);

  const setWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_KEY, ws);
    }
  };

  return {
    activeWorkspace,
    setWorkspace,
    defaultWorkspace: profile?.default_workspace ?? "cx",
  };
}
