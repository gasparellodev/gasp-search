import { SearchForm } from "@/components/search/search-form";

export const metadata = { title: "Buscar" };

export default function SearchPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Buscar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Disparar buscas no Google Maps e Instagram via Apify.
        </p>
      </div>
      <SearchForm />
    </div>
  );
}
