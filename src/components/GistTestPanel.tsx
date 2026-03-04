import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const ENDPOINTS = [
  { value: "contacts", label: "Contatos" },
  { value: "conversations", label: "Conversas" },
  { value: "tags", label: "Tags" },
  { value: "segments", label: "Segmentos" },
  { value: "teammates", label: "Teammates" },
  { value: "campaigns", label: "Campanhas" },
  { value: "token", label: "Workspace Info" },
];

interface GistTestPanelProps {
  onClose: () => void;
}

export function GistTestPanel({ onClose }: GistTestPanelProps) {
  const [endpoint, setEndpoint] = useState("contacts");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 15;

  const testConnection = async (ep?: string, p?: number) => {
    const target = ep || endpoint;
    const targetPage = p ?? page;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params: Record<string, string> = { per_page: String(perPage), page: String(targetPage) };
      const { data, error: fnError } = await supabase.functions.invoke("gist-proxy", {
        body: { endpoint: target, params },
      });

      if (fnError) { setError(fnError.message); setConnected(false); return; }
      if (data?.error) { setError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error)); setConnected(false); return; }

      setResult(data);
      setConnected(true);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEndpointChange = (val: string) => {
    setEndpoint(val);
    setPage(1);
    setResult(null);
    setError(null);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    testConnection(endpoint, newPage);
  };

  const getItems = (): any[] => {
    if (!result) return [];
    // Gist wraps lists in keys like contacts, conversations, tags, etc.
    for (const key of ['contacts', 'conversations', 'campaigns', 'tags', 'segments', 'teammates']) {
      if (result[key] && Array.isArray(result[key])) return result[key];
    }
    // single object (token/workspace)
    if (typeof result === 'object' && !Array.isArray(result)) return [result];
    return [];
  };

  const getTotalCount = (): number | null => {
    if (result?.pages?.total_count) return result.pages.total_count;
    if (result?.total_count) return result.total_count;
    return null;
  };

  const getTotalPages = (): number => {
    if (result?.pages?.total_pages) return result.pages.total_pages;
    const total = getTotalCount();
    if (total) return Math.ceil(total / perPage);
    return 1;
  };

  const items = getItems();
  const totalCount = getTotalCount();
  const totalPages = getTotalPages();

  return (
    <Card className="border-0 shadow-lg mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Testar Conexão Gist
            {connected === true && <Badge variant="default" className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>}
            {connected === false && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-center">
          <Select value={endpoint} onValueChange={handleEndpointChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENDPOINTS.map((ep) => (
                <SelectItem key={ep.value} value={ep.value}>{ep.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => testConnection()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Testar
          </Button>
          {totalCount !== null && (
            <span className="text-xs text-muted-foreground ml-2">{totalCount} registros</span>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">{error}</div>
        )}

        {result && items.length > 0 && (
          <>
            <EndpointTable endpoint={endpoint} items={items} />
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {result && items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado.</div>
        )}
      </CardContent>
    </Card>
  );
}

function EndpointTable({ endpoint, items }: { endpoint: string; items: any[] }) {
  switch (endpoint) {
    case "contacts": return <ContactsTable items={items} />;
    case "conversations": return <ConversationsTable items={items} />;
    case "tags": return <TagsTable items={items} />;
    case "segments": return <SegmentsTable items={items} />;
    case "teammates": return <TeammatesTable items={items} />;
    case "campaigns": return <CampaignsTable items={items} />;
    default: return <GenericTable items={items} />;
  }
}

function ContactsTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg border overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Último acesso</TableHead>
            <TableHead>Segmentos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c, i) => (
            <TableRow key={c.id || i}>
              <TableCell className="font-medium text-xs">{c.name || '—'}</TableCell>
              <TableCell className="text-xs">{c.email || '—'}</TableCell>
              <TableCell className="text-xs">{c.location_data?.city_name || '—'}</TableCell>
              <TableCell className="text-xs">{c.last_seen_at ? new Date(c.last_seen_at * 1000).toLocaleDateString('pt-BR') : '—'}</TableCell>
              <TableCell className="text-xs">
                {c.segments?.map((s: any) => s.name).join(', ') || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ConversationsTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg border overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contato</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Mensagens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c, i) => (
            <TableRow key={c.id || i}>
              <TableCell className="text-xs font-medium">
                {c.contacts?.contacts?.[0]?.name || c.contacts?.contacts?.[0]?.email || '—'}
              </TableCell>
              <TableCell className="text-xs">{c.channel || '—'}</TableCell>
              <TableCell className="text-xs">
                <Badge variant={c.state === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                  {c.state === 'open' ? 'Aberta' : 'Fechada'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{c.assignee?.name || '—'}</TableCell>
              <TableCell className="text-xs">{c.conversation_message?.conversation_parts?.total_count ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TagsTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg border overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((t, i) => (
            <TableRow key={t.id || i}>
              <TableCell className="text-xs font-medium">{t.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.id}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SegmentsTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg border overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((s, i) => (
            <TableRow key={s.id || i}>
              <TableCell className="text-xs font-medium">{s.name}</TableCell>
              <TableCell className="text-xs">{s.person_type || '—'}</TableCell>
              <TableCell className="text-xs">
                {s.created_at ? new Date(s.created_at * 1000).toLocaleDateString('pt-BR') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TeammatesTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg border overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((t, i) => (
            <TableRow key={t.id || i}>
              <TableCell className="text-xs font-medium">{t.name || '—'}</TableCell>
              <TableCell className="text-xs">{t.email || '—'}</TableCell>
              <TableCell className="text-xs">
                <Badge variant={t.away_mode_enabled ? 'secondary' : 'default'} className="text-[10px]">
                  {t.away_mode_enabled ? 'Ausente' : 'Online'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CampaignsTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg border overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Tipo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c, i) => (
            <TableRow key={c.id || i}>
              <TableCell className="text-xs font-medium">{c.title || c.name || '—'}</TableCell>
              <TableCell className="text-xs">{c.state || '—'}</TableCell>
              <TableCell className="text-xs">{c.type || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GenericTable({ items }: { items: any[] }) {
  return (
    <div className="rounded-lg bg-muted p-3 max-h-80 overflow-auto">
      <pre className="text-xs whitespace-pre-wrap break-all">
        {JSON.stringify(items, null, 2)}
      </pre>
    </div>
  );
}
