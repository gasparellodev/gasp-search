import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="min-w-0 space-y-12">
      <div>
        <h1 className="sk-h1">Dashboard</h1>
        <p className="sk-body-lg text-muted-foreground mt-2">
          Visão geral dos seus leads e buscas recentes.
        </p>
      </div>

      <DashboardView />
    </div>
  );
}
