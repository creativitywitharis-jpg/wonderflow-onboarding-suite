import { supabase } from "./supabase";

export type ConnectionStatus = "connected" | "disconnected" | "error";

export type DbConnection = {
  id: string;
  provider: string;
  status: ConnectionStatus;
  config: Record<string, unknown>;
  updated_at: string;
};

const COLS = "id,provider,status,config,updated_at";

/** All integration connections for an org (RLS-scoped to members). */
export async function listConnections(orgId: string): Promise<DbConnection[]> {
  const { data, error } = await supabase.from("connections").select(COLS).eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return (data as DbConnection[]) ?? [];
}

/** Upsert a connection's status (owner/admin only, enforced by RLS). */
export async function setConnection(orgId: string, provider: string, status: ConnectionStatus) {
  const { error } = await supabase
    .from("connections")
    .upsert({ org_id: orgId, provider, status }, { onConflict: "org_id,provider" });
  return { error: error ? new Error(error.message) : null };
}

/** Pull real customers from Stripe into the CRM. Returns how many were added. */
export async function syncStripe(orgId: string): Promise<{ synced: number; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("sync-stripe", { body: { orgId } });
    if (error) return { synced: 0, error: new Error(error.message) };
    if (data?.error) return { synced: 0, error: new Error(data.error as string) };
    return { synced: (data?.synced as number) ?? 0, error: null };
  } catch (e) {
    return { synced: 0, error: e instanceof Error ? e : new Error("Sync failed") };
  }
}
