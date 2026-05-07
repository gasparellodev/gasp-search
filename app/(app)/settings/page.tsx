import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Preferências da conta.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Configurações da conta serão adicionadas após a Fase 1.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
