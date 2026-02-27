import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Key, ExternalLink } from "lucide-react";

const SettingsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas chaves de API e preferências</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
                <Key className="h-4 w-4 text-accent-foreground" />
              </div>
              API Keys
            </CardTitle>
            <CardDescription>
              As chaves são armazenadas de forma segura no backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gist API Key</label>
              <div className="flex gap-2">
                <Input type="password" placeholder="Cole sua API Key do Gist" disabled />
                <Button variant="outline" size="sm" disabled>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Obter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre em: Gist Dashboard → Settings → API & Integrations
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Google Gemini API Key</label>
              <div className="flex gap-2">
                <Input type="password" placeholder="Cole sua API Key do Gemini" disabled />
                <Button variant="outline" size="sm" disabled>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Obter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre em: Google AI Studio → API Keys
              </p>
            </div>

            <div className="pt-2">
              <p className="text-sm text-muted-foreground bg-accent/50 p-3 rounded-xl">
                ⚠️ As API Keys serão configuradas como secrets seguros no backend. Entre em contato para configurá-las.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
