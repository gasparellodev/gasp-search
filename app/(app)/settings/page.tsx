import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstanceCard } from "@/components/whatsapp/instance-card";
import { publicEnv } from "@/lib/env-public";

export const metadata = { title: "Configurações" };

export default function SettingsPage() {
  const whatsappEnabled = publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED === "1";
  return (
    <div className="min-w-0 space-y-10">
      <div>
        <h1 className="sk-h2">Configurações</h1>
        <p className="sk-body-lg text-muted-foreground mt-2">
          Preferências da conta e integrações.
        </p>
      </div>
      {whatsappEnabled && <InstanceCard />}
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Mais preferências da conta serão adicionadas em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
