import { DashboardView } from "@/components/dashboard/dashboard-view";

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

      <DashboardView />
    </div>
  );
}
