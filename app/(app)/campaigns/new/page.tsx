import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { publicEnv } from "@/lib/env-public";
import { createServerSupabase } from "@/lib/supabase/server";
import { CAMPAIGN_MAX_LEADS } from "@/lib/validators/campaigns";

export const metadata = { title: "Nova campanha" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ leads?: string }>;
}

export default async function NewCampaignPage({ searchParams }: PageProps) {
  if (publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") redirect("/dashboard");

  const params = await searchParams;
  const leadIds = (params.leads ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, CAMPAIGN_MAX_LEADS);

  const supabase = await createServerSupabase();
  const { data: leads } = leadIds.length
    ? await supabase
        .from("leads")
        .select(
          "id, name, source, category, city, state, country, phone, email, website, instagram_handle, whatsapp, has_website, rating, reviews_count, followers_count, stage, score, notes",
        )
        .in("id", leadIds)
    : { data: [] };

  return (
    <div className="min-w-0 max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="sk-h2">Nova campanha</h1>
        <p className="sk-body-lg text-muted-foreground mt-2">
          Selecione leads em <code>/leads</code> e volte aqui para escolher
          modo e disparar.
        </p>
      </div>

      {!leads || leads.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          Nenhum lead selecionado. Vá para{" "}
          <Link href="/leads" className="underline">
            /leads
          </Link>
          , selecione até {CAMPAIGN_MAX_LEADS} leads e use a ação &quot;Nova
          campanha&quot;.
        </div>
      ) : (
        <CampaignForm selectedLeads={leads} />
      )}
    </div>
  );
}
