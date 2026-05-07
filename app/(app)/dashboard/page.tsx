import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visão geral dos seus leads e buscas recentes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total de leads</CardTitle>
            <CardDescription>Todos os estágios</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Novos (7 dias)</CardTitle>
            <CardDescription>Captados na última semana</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Em conversa</CardTitle>
            <CardDescription>Pipeline ativo</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Qualificados</CardTitle>
            <CardDescription>Prontos para fechamento</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">—</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas buscas</CardTitle>
          <CardDescription>
            Histórico de execuções no Apify (Google Maps, Instagram, enriquecimento).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Nenhuma busca ainda. Vá para <strong>Buscar</strong> e dispare a
            primeira.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
