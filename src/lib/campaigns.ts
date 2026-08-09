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
  created_at: string;
};

export type NewCampaign = {
  name: string;
  channel?: string;
  status?: CampaignStatus;
  audience?: string | null;
  budget?: number;
};

const COLS = "id,name,channel,status,audience,sent,open_rate,click_rate,roi,budget,created_at";

/** All campaigns for an org, newest first (RLS-scoped to members). */
export async function listCampaigns(orgId: string): Promise<DbCampaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbCampaign[]) ?? [];
}

export async function createCampaign(orgId: string, c: NewCampaign) {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ org_id: orgId, ...c })
    .select(COLS)
    .single();
  return { data: data as DbCampaign | null, error: error ? new Error(error.message) : null };
}

export async function insertCampaigns(orgId: string, rows: NewCampaign[]) {
  const { error } = await supabase.from("campaigns").insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function updateCampaign(id: string, patch: Partial<Omit<DbCampaign, "id" | "created_at">>) {
  const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
