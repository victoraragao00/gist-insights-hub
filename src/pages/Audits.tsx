import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

const Audits = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
        <p className="text-muted-foreground">
          Alertas automáticos baseados nos seus indicadores (Fase 6)
        </p>
      </div>

      <Card className="border border-border">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Em desenvolvimento</h3>
          <p className="text-muted-foreground mt-1 max-w-md">
            A gestão de auditorias e alertas será disponibilizada em uma próxima fase do CX Hub.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Audits;
