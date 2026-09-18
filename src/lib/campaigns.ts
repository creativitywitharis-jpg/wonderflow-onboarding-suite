import { supabase } from "./supabase";

export type CampaignStatus = "Active" | "Scheduled" | "Draft" | "Done";

export type DbCampaign = {
  id: string;
  name: string;
  channel: string;
  status: CampaignStatus;
  audience: string | null;
  sent: number;
  open_rate: number;
  click_rate: number;
  roi: number;
  budget: number;
  scheduled_at: string | null;
  subject: string | null;
  body: string | null;
  created_at: string;
};

export type NewCampaign = {
  name: string;
  channel?: string;
  status?: CampaignStatus;
  audience?: string | null;
  budget?: number;
  scheduled_at?: string | null;
  subject?: string | null;
  body?: string | null;
};

const COLS = "id,name,channel,status,audience,sent,open_rate,click_rate,roi,budget,scheduled_at,subject,body,created_at";
// scheduled_at ships in migration 0048 — reach the table untyped until
// Lovable regenerates DB types. Runtime behaviour is unchanged once it does.
const campaignsTable = () => (supabase as unknown as { from: (t: string) => any }).from("campaigns");

/** All campaigns for an org, newest first (RLS-scoped to members). */
export async function listCampaigns(orgId: string): Promise<DbCampaign[]> {
  const { data, error } = await campaignsTable()
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbCampaign[]) ?? [];
}

export async function createCampaign(orgId: string, c: NewCampaign) {
  const { data, error } = await campaignsTable()
    .insert({ org_id: orgId, ...c })
    .select(COLS)
    .single();
  return { data: data as DbCampaign | null, error: error ? new Error(error.message) : null };
}

export async function insertCampaigns(orgId: string, rows: NewCampaign[]) {
  const { error } = await campaignsTable().insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function updateCampaign(id: string, patch: Partial<Omit<DbCampaign, "id" | "created_at">>) {
  const { error } = await campaignsTable().update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Actually send an Email campaign via Resend, to every real customer in its audience. */
export async function sendCampaign(campaignId: string): Promise<{ sent: number; failed: number; skipped: number; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("send-campaign", {
    body: { campaignId, origin: window.location.origin },
  });
  if (error) return { sent: 0, failed: 0, skipped: 0, error: error.message };
  if (data?.error) return { sent: 0, failed: 0, skipped: 0, error: data.error as string };
  return { sent: data?.sent ?? 0, failed: data?.failed ?? 0, skipped: data?.skipped ?? 0, error: null };
}
