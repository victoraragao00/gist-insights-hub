import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";
import { KPICard } from "@/components/KPICard";
import { MessageSquare } from "lucide-react";

const InteractionsPage = () => {
  const { user } = useAuth();
  const { selectedClient } = useClient();

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
