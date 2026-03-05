import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useClient } from "@/context/ClientContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

function SyncProgressBar() {
  const { syncState, cancelSync } = useClient();

  if (!syncState.syncing) return null;

  return (
    <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center gap-3">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-foreground">
          <span className="font-medium truncate">
            {syncState.currentClientName ?? "Preparando..."}
          </span>
          {syncState.totalClients > 0 && (
            <span className="text-muted-foreground shrink-0">
              ({syncState.currentClientIndex}/{syncState.totalClients})
            </span>
          )}
          <span className="text-muted-foreground shrink-0">
            — {syncState.progressPct}%
          </span>
          {syncState.estimatedRemaining && (
            <span className="text-muted-foreground shrink-0">
              — {syncState.estimatedRemaining}
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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
          </header>
          <SyncProgressBar />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
