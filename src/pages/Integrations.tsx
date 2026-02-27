import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  MessageCircle,
  Hash,
  FileText,
  Users,
  Mail,
  Plug,
  Plus,
  Check,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Platform {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  authTypes: string[];
  category: string;
}

const platforms: Platform[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Pagamentos, assinaturas e receita recorrente",
    icon: CreditCard,
    color: "bg-violet-100 text-violet-700",
    authTypes: ["api_key"],
    category: "Financeiro",
  },
  {
    id: "gist",
    name: "Gist",
    description: "Conversas, contatos e campanhas de marketing",
    icon: MessageCircle,
    color: "bg-blue-100 text-blue-700",
    authTypes: ["api_key", "token"],
    category: "Comunicação",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues, projetos e ciclos de desenvolvimento",
    icon: Hash,
    color: "bg-indigo-100 text-indigo-700",
    authTypes: ["api_key", "oauth"],
    category: "Produtividade",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Páginas, databases e conteúdo colaborativo",
    icon: FileText,
    color: "bg-gray-100 text-gray-700",
    authTypes: ["token", "oauth"],
    category: "Produtividade",
  },
  {
    id: "tudo1",
    name: "TUDO1",
    description: "CRM completo com gestão de leads e pipeline",
    icon: Users,
    color: "bg-emerald-100 text-emerald-700",
    authTypes: ["api_key", "token"],
    category: "CRM",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Mensagens, notificações e atendimento",
    icon: MessageCircle,
    color: "bg-green-100 text-green-700",
    authTypes: ["token"],
    category: "Comunicação",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Canais, mensagens e notificações de equipe",
    icon: Hash,
    color: "bg-purple-100 text-purple-700",
    authTypes: ["token", "oauth"],
    category: "Comunicação",
  },
  {
    id: "custom",
    name: "API Customizada",
    description: "Conecte qualquer API REST com autenticação",
    icon: Plug,
    color: "bg-orange-100 text-orange-700",
    authTypes: ["api_key", "token"],
    category: "Outro",
  },
];

const Integrations = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authType, setAuthType] = useState("api_key");
  const [credential, setCredential] = useState("");
  const [customName, setCustomName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const openConnect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setAuthType(platform.authTypes[0]);
    setCredential("");
    setCustomName("");
    setCustomBaseUrl("");
    setDialogOpen(true);
  };

  const handleConnect = async () => {
    if (!credential.trim()) {
      toast({ title: "Preencha a credencial", variant: "destructive" });
      return;
    }
    if (selectedPlatform?.id === "custom" && !customBaseUrl.trim()) {
      toast({ title: "Preencha a URL base da API", variant: "destructive" });
      return;
    }

    setConnecting(true);
    // TODO: Save to database via Supabase (requires auth)
    setTimeout(() => {
      setConnecting(false);
      setDialogOpen(false);
      toast({
        title: "Integração salva",
        description: `${selectedPlatform?.name} foi conectada. Configure a autenticação para ativar.`,
      });
    }, 1000);
  };

  const categories = [...new Set(platforms.map((p) => p.category))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">
            Conecte suas plataformas e centralize seus dados
          </p>
        </div>

        {categories.map((category) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platforms
                .filter((p) => p.category === category)
                .map((platform) => (
                  <Card
                    key={platform.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${platform.color}`}>
                            <platform.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm">{platform.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {platform.description}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <Badge variant="outline" className="text-xs">
                          Desconectado
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => openConnect(platform)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Conectar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlatform && (
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedPlatform.color}`}>
                  <selectedPlatform.icon className="h-4 w-4" />
                </div>
              )}
              Conectar {selectedPlatform?.name}
            </DialogTitle>
            <DialogDescription>
              Insira suas credenciais para conectar {selectedPlatform?.name} ao Hub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedPlatform?.id === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Nome da integração</Label>
                  <Input
                    placeholder="Minha API"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Base</Label>
                  <Input
                    placeholder="https://api.exemplo.com/v1"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                  />
                </div>
              </>
            )}

            {selectedPlatform && selectedPlatform.authTypes.length > 1 && (
              <div className="space-y-2">
                <Label>Tipo de autenticação</Label>
                <Select value={authType} onValueChange={setAuthType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPlatform.authTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "api_key" ? "API Key" : t === "oauth" ? "OAuth" : "Token"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {authType === "api_key" ? "API Key" : authType === "oauth" ? "Client ID" : "Token de Acesso"}
              </Label>
              <Input
                type="password"
                placeholder={authType === "api_key" ? "sk_live_..." : "Insira seu token"}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Integrations;
