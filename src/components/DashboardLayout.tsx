import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useClient } from "@/context/ClientContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

function SyncProgressBar() {
  const { syncState, cancelSync } = useClient();

  if (!syncState.syncing) return null;

  return (
    <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center gap-3">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-foreground">
          <span className="font-medium truncate">
            {syncState.currentLabel ?? "Preparando..."}
          </span>
          <span className="text-muted-foreground shrink-0">
            — {syncState.progressPct}%
          </span>
          {syncState.elapsedDisplay && (
            <span className="text-muted-foreground shrink-0">
              — {syncState.elapsedDisplay}
            </span>
          )}
        </div>
        <Progress value={syncState.progressPct} className="h-1.5 mt-1" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={cancelSync}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <header className="h-14 shrink-0 flex items-center border-b px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <NotificationBell />
          </header>
          <SyncProgressBar />
          <main className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
