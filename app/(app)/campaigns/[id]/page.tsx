import { notFound, redirect } from "next/navigation";
import { CampaignProgress } from "@/components/campaigns/campaign-progress";
import {
  TargetStatusTable,
  type TargetRow,
} from "@/components/campaigns/target-status-table";
import { publicEnv } from "@/lib/env-public";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  if (publicEnv.NEXT_PUBLIC_WHATSAPP_ENABLED !== "1") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, name, mode, status, total_count, sent_count, failed_count, started_at, completed_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const { data: targets } = await supabase
    .from("campaign_targets")
    .select("lead_id, status, error_message, sent_message_id")
    .eq("campaign_id", id);

  const leadIds = (targets ?? []).map((t) => t.lead_id);
  const { data: leadRows } = leadIds.length
    ? await supabase.from("leads").select("id, name").in("id", leadIds)
    : { data: [] };
  const leadMap = new Map<string, string>(
    (leadRows ?? []).map((l) => [l.id, l.name]),
  );

  const enrichedTargets: TargetRow[] = (targets ?? []).map((t) => ({
    lead_id: t.lead_id,
    lead_name: leadMap.get(t.lead_id) ?? null,
    status: t.status,
    error_message: t.error_message,
    sent_message_id: t.sent_message_id,
  }));

  return (
    <div className="min-w-0 max-w-4xl space-y-6 p-4 sm:p-6">
      <CampaignProgress
        initial={{
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          total_count: campaign.total_count,
          sent_count: campaign.sent_count,
          failed_count: campaign.failed_count,
          started_at: campaign.started_at,
          completed_at: campaign.completed_at,
        }}
      />
      <TargetStatusTable targets={enrichedTargets} />
    </div>
  );
}
