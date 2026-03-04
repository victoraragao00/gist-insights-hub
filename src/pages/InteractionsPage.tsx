import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";
import { KPICard } from "@/components/KPICard";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncResult {
  contacts_processed: number;
  contacts_unresolved: number;
  clients_created: number;
  clients_updated: number;
  clients_inactivated: number;
  participants_created: number;
  participants_updated: number;
  errors: string[];
  has_more: boolean;
  next_page: number | null;
  total_pages: number | null;
}

interface IngestResult {
  conversations_fetched: number;
  messages_fetched: number;
  messages_inserted: number;
  messages_skipped: number;
  messages_quarantined: number;
  errors: string[];
  has_more: boolean;
  next_page?: number;
}

const DELETE_CLIENT_ID = "a333ad32-6295-4ac5-a15f-6d3931130315";

const InteractionsPage = () => {
  const { user } = useAuth();
  const { selectedClient } = useClient();
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [ingestLog, setIngestLog] = useState<string[]>([]);

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

  // --- Sync contacts loop ---
  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncLog([]);

    const totals: Partial<SyncResult> = {
      contacts_processed: 0,
      contacts_unresolved: 0,
      clients_created: 0,
      clients_updated: 0,
      participants_created: 0,
      participants_updated: 0,
      errors: [],
    };

    let page = 1;
    let batch = 0;

    try {
      while (true) {
        batch++;
        setSyncLog((prev) => [...prev, `⏳ Batch ${batch} — página ${page}...`]);

        const { data, error } = await supabase.functions.invoke("sync-gist-contacts", {
          body: { page, max_pages: 5 },
        });

        if (error) {
          setSyncLog((prev) => [...prev, `❌ Erro: ${error.message}`]);
          break;
        }

        const result = data?.result as SyncResult | undefined;
        if (!result) {
          setSyncLog((prev) => [...prev, `❌ Resposta inesperada: ${JSON.stringify(data)}`]);
          break;
        }

        totals.contacts_processed! += result.contacts_processed;
        totals.contacts_unresolved! += result.contacts_unresolved;
        totals.clients_created! += result.clients_created;
        totals.clients_updated! += result.clients_updated;
        totals.participants_created! += result.participants_created;
        totals.participants_updated! += result.participants_updated;
        if (result.errors?.length) totals.errors!.push(...result.errors);

        setSyncLog((prev) => [
          ...prev,
          `✅ Batch ${batch}: +${result.contacts_processed} contatos (total: ${totals.contacts_processed})`,
        ]);

        if (!result.has_more || !result.next_page) {
          setSyncLog((prev) => [...prev, `🏁 Sync completa! Total: ${totals.contacts_processed} contatos processados.`]);
          break;
        }

        page = result.next_page;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncLog((prev) => [...prev, `❌ Erro fatal: ${msg}`]);
    }

    setSyncLog((prev) => [...prev, `\n📊 Resumo final:\n${JSON.stringify(totals, null, 2)}`]);
    setSyncing(false);
  };

  // --- Ingest historical loop ---
  const handleIngestHistory = async () => {
    setIngesting(true);
    setIngestLog([]);

    const totals = {
      conversations_fetched: 0,
      messages_fetched: 0,
      messages_inserted: 0,
      messages_quarantined: 0,
      errors: [] as string[],
    };

    let page = 1;
    let batch = 0;
    let isFirstCall = true;

    try {
      while (true) {
        batch++;
        const bodyPayload: Record<string, unknown> = { page, max_pages: 5 };

        // First call includes delete_client_id to clean up
        if (isFirstCall) {
          bodyPayload.delete_client_id = DELETE_CLIENT_ID;
          setIngestLog((prev) => [...prev, `🗑️ Deletando interações do client ${DELETE_CLIENT_ID}...`]);
          isFirstCall = false;
        }

        setIngestLog((prev) => [...prev, `⏳ Batch ${batch} — página ${page}...`]);

        const { data, error } = await supabase.functions.invoke("ingest-gist-historical", {
          body: bodyPayload,
        });

        if (error) {
          setIngestLog((prev) => [...prev, `❌ Erro: ${error.message}`]);
          break;
        }

        const result = data as IngestResult | null;
        if (!result) {
          setIngestLog((prev) => [...prev, `❌ Resposta inesperada: ${JSON.stringify(data)}`]);
          break;
        }

        totals.conversations_fetched += result.conversations_fetched;
        totals.messages_fetched += result.messages_fetched;
        totals.messages_inserted += result.messages_inserted;
        totals.messages_quarantined += result.messages_quarantined;
        if (result.errors?.length) totals.errors.push(...result.errors);

        setIngestLog((prev) => [
          ...prev,
          `✅ Batch ${batch}: ${result.conversations_fetched} conversas, +${result.messages_inserted} inseridas, ${result.messages_quarantined} quarentena`,
        ]);

        if (!result.has_more || !result.next_page) {
          setIngestLog((prev) => [...prev, `🏁 Importação completa!`]);
          break;
        }

        page = result.next_page;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setIngestLog((prev) => [...prev, `❌ Erro fatal: ${msg}`]);
    }

    setIngestLog((prev) => [
      ...prev,
      `\n📊 Resumo final:`,
      `  Conversas: ${totals.conversations_fetched}`,
      `  Mensagens inseridas: ${totals.messages_inserted}`,
      `  Mensagens quarentena: ${totals.messages_quarantined}`,
      `  Erros: ${totals.errors.length}`,
      totals.errors.length > 0 ? `  ${totals.errors.join('\n  ')}` : '',
    ].filter(Boolean));

    setIngesting(false);
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

      {/* Sync contacts test */}
      <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">🧪 Teste: sync-gist-contacts (loop automático)</p>
        <Button onClick={handleSyncAll} disabled={syncing} variant="outline" size="sm">
          {syncing ? "Sincronizando..." : "Iniciar sync completa"}
        </Button>
        {syncLog.length > 0 && (
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96 whitespace-pre-wrap">
            {syncLog.join("\n")}
          </pre>
        )}
      </div>

      {/* Ingest historical test */}
      <div className="border border-dashed border-muted-foreground/30 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">🧪 Teste: ingest-gist-historical (loop automático)</p>
        <p className="text-xs text-muted-foreground">Deleta interações do client {DELETE_CLIENT_ID} e reimporta todo histórico.</p>
        <Button onClick={handleIngestHistory} disabled={ingesting} variant="outline" size="sm">
          {ingesting ? "Importando..." : "Importar histórico Gist"}
        </Button>
        {ingestLog.length > 0 && (
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96 whitespace-pre-wrap">
            {ingestLog.join("\n")}
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
