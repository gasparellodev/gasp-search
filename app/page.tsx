import { Button } from "@/components/ui/button";

// Landing temporária. Substituída em #11 pelo layout (app) com auth + sidebar
// que redireciona para /dashboard.
export default function RootPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="space-y-3">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">
          GaspLab
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Gasp Search
        </h1>
        <p className="text-muted-foreground mx-auto max-w-md text-base">
          Captação, qualificação e gestão de leads para desenvolvimento de
          sites e automação. Em construção.
        </p>
      </div>
      <Button variant="outline" disabled>
        Login (em breve)
      </Button>
    </main>
  );
}
