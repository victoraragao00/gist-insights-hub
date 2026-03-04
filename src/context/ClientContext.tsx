import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ImportProgress {
  currentPage: number;
  conversationsTotal: number;
  messagesTotal: number;
  done: boolean;
  error?: string;
}

interface IngestionResult {
  conversations_fetched: number;
  messages_fetched: number;
  messages_inserted: number;
  messages_skipped: number;
  errors: string[];
  has_more: boolean;
  next_page?: number;
}

interface ClientContextValue {
  clients: Client[];
  selectedClient: Client | null;
  setSelectedClient: (client: Client) => void;
  loading: boolean;
  importing: boolean;
  importProgress: ImportProgress | null;
  handleImportHistory: () => Promise<void>;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, metadata, created_at")
        .order("name")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  // Auto-select first client when list loads
  if (clients.length > 0 && !selectedClient) {
    setSelectedClient(clients[0]);
  }

  const handleImportHistory = useCallback(async () => {
    setImporting(true);
    setImportProgress({ currentPage: 1, conversationsTotal: 0, messagesTotal: 0, done: false });

    let page = 1;
    let totalConversations = 0;
    let totalMessages = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        setImportProgress({
          currentPage: page,
          conversationsTotal: totalConversations,
          messagesTotal: totalMessages,
          done: false,
        });

        const { data, error } = await supabase.functions.invoke("ingest-gist-historical", {
          body: { page },
        });

        if (error) throw new Error(typeof error === "string" ? error : "Erro na importação");

        const result = data as IngestionResult | null;
        if (!result) throw new Error("Resposta vazia");

        totalConversations += result.conversations_fetched;
        totalMessages += result.messages_fetched;
        hasMore = result.has_more;
        page = result.next_page ?? page + 1;
      }

      setImportProgress({
        currentPage: page,
        conversationsTotal: totalConversations,
        messagesTotal: totalMessages,
        done: true,
      });

      queryClient.invalidateQueries({ queryKey: ["interactions_count"] });
      toast.success(`✓ Importação concluída: ${totalConversations} conversas, ${totalMessages} mensagens`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setImportProgress((prev) => prev ? { ...prev, done: true, error: msg } : null);
      toast.error("Erro na importação: " + msg);
    } finally {
      setImporting(false);
    }
  }, []);

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClient,
        setSelectedClient,
        loading: isLoading,
        importing,
        importProgress,
        handleImportHistory,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used inside <ClientProvider>");
  return ctx;
}
