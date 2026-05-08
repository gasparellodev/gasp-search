import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { publicEnv } from "@/lib/env-public";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Campanhas" };
export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  running: "Em execução",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export default async function CampaignsListPage() {
  if (publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") redirect("/dashboard");

  const supabase = await createServerSupabase();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, name, mode, status, total_count, sent_count, failed_count, started_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Disparos em massa para WhatsApp dos seus leads.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="size-4" /> Nova campanha
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!campaigns || campaigns.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma campanha ainda. Clique em &quot;Nova campanha&quot; pra
              começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Criada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.mode === "template" ? "Template" : "IA por lead"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {statusLabel[c.status] ?? c.status}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.sent_count + c.failed_count}/{c.total_count}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
