import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Sua base de leads captados, com filtros e tags.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nenhum lead ainda</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Faça sua primeira busca em{" "}
            <strong>Buscar</strong> para captar leads aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
