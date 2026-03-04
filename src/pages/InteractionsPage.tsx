import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";
import { KPICard } from "@/components/KPICard";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const InteractionsPage = () => {
  const { user } = useAuth();
  const { selectedClient } = useClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { data: count = 0, isLoading } = useQuery<number>({
    queryKey: ["interactions_count", selectedClient?.id, user?.id],
    enabled: !!selectedClient?.id && !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count: total, error } = await supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", selectedClient!.id);
      if (error) throw error;
      return total ?? 0;
    },
  });

  const handleSyncTest = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-gist-contacts", {
        body: { page: 1, max_pages: 1 },
      });
      const result = JSON.stringify({ data, error }, null, 2);
      console.log("SYNC RESULT:", result);
      setSyncResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("SYNC ERROR:", msg);
      setSyncResult(`ERROR: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Interações</h1>
        <p className="text-muted-foreground">
          Feed unificado — {selectedClient?.name ?? "..."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Total de Interações"
          value={count}
          subtitle={`Mensagens importadas de ${selectedClient?.name ?? "..."}`}
          icon={MessageSquare}
          isLoading={isLoading}
        />
      </div>

      {/* Temporary sync test button */}
      <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">🧪 Teste: sync-gist-contacts</p>
        <Button onClick={handleSyncTest} disabled={syncing} variant="outline" size="sm">
          {syncing ? "Sincronizando..." : "Invocar sync-gist-contacts (1 página)"}
        </Button>
        {syncResult && (
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96 whitespace-pre-wrap">
            {syncResult}
          </pre>
        )}
      </div>

      {!isLoading && count === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">A classificação por IA será exibida aqui após o Step 6.</p>
        </div>
      )}
    </div>
  );
};

export default InteractionsPage;
