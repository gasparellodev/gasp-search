import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Buscar" };

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Buscar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Disparar buscas no Google Maps e Instagram via Apify.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Formulário de busca chega na issue #16 (Fase 2 — Search Engine).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
