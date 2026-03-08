import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search as SearchIcon, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSearchInteractions } from "@/hooks/useSearchInteractions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  critico: { label: "🔴 Crítico", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
};

interface ClientOption {
  id: string;
  name: string;
}

const SearchPage = () => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [clientId, setClientId] = useState<string>("all");
  const [tone, setTone] = useState<string>("all");
  const [page, setPage] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
      setPage(0);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  const { data: results = [], isLoading, isError, refetch } = useSearchInteractions({
    query: debouncedQuery,
    clientId: clientId === "all" ? undefined : clientId,
    tone: tone === "all" ? undefined : tone,
    page,
    limit: PAGE_SIZE,
  });

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ["clients_options", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientOption[];
    },
  });

  const totalCount = results[0]?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const showResults = debouncedQuery.length >= 3;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Busca de Interações</h1>
        <p className="text-muted-foreground">
          Busque em todas as interações classificadas
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em todas as interações..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={clientId} onValueChange={(v) => { setClientId(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tone} onValueChange={(v) => { setTone(v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tom" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ok">Ok</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="alerta">Alerta</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao buscar</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os resultados. Tente novamente.
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isError && !showResults && (
        <p className="text-sm text-muted-foreground">Digite ao menos 3 caracteres para buscar</p>
      )}

      {!isError && showResults && isLoading && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-28 animate-shimmer" />
              <Skeleton className="h-5 w-24 animate-shimmer" />
              <Skeleton className="h-5 flex-1 animate-shimmer" />
              <Skeleton className="h-5 w-20 animate-shimmer" />
              <Skeleton className="h-5 w-16 animate-shimmer" />
              <Skeleton className="h-5 w-24 animate-shimmer" />
            </div>
          ))}
        </div>
      )}

      {!isError && showResults && !isLoading && results.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para &quot;{debouncedQuery}&quot;</p>
      )}

      {!isError && showResults && !isLoading && results.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} resultados
          </p>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Remetente</TableHead>
                  <TableHead>Corpo</TableHead>
                  <TableHead>Tom</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const toneCfg = TONE_CONFIG[r.tone] ?? TONE_CONFIG.ok;
                  const sideClass = r.sender_side === "customer"
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-sm">{r.client_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs border-0 ${sideClass}`}>
                          {r.sender_raw || r.sender_side || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={r.body}>
                        {r.body?.length > 100 ? `${r.body.slice(0, 100)}…` : r.body || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs border-0 ${toneCfg.className}`}>
                          {toneCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.theme || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(r.occurred_at), { locale: ptBR, addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;
