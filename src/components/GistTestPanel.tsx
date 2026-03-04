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
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const ENDPOINTS = [
  { value: "token", label: "Workspace Info" },
  { value: "contacts", label: "Contatos" },
  { value: "conversations", label: "Conversas" },
  { value: "campaigns", label: "Campanhas" },
  { value: "tags", label: "Tags" },
  { value: "segments", label: "Segmentos" },
  { value: "teammates", label: "Teammates" },
];

interface GistTestPanelProps {
  onClose: () => void;
}

export function GistTestPanel({ onClose }: GistTestPanelProps) {
  const [endpoint, setEndpoint] = useState("token");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const testConnection = async (ep?: string) => {
    const target = ep || endpoint;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("gist-proxy", {
        body: { endpoint: target },
      });

      if (fnError) {
        setError(fnError.message);
        setConnected(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setConnected(false);
        return;
      }

      setResult(data);
      setConnected(true);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex gap-2">
          <Select value={endpoint} onValueChange={setEndpoint}>
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
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg bg-muted p-3 max-h-80 overflow-auto">
            <pre className="text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
