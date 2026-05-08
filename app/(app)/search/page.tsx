import { SearchForm } from "@/components/search/search-form";

export const metadata = { title: "Buscar" };

export default function SearchPage() {
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-10">
      <div>
        <h1 className="sk-h2">Buscar</h1>
        <p className="sk-body-lg text-muted-foreground mt-2">
          Disparar buscas no Google Maps e Instagram via Apify.
        </p>
      </div>
      <SearchForm />
    </div>
  );
}
