import { supabase } from "./supabase";

export type AuditCategory = "Users" | "Integrations" | "Security";

export type AuditEntry = {
  id: string;
  actor_name: string;
  action: string;
  category: AuditCategory;
  created_at: string;
};

const COLS = "id,actor_name,action,category,created_at";
// Ships in migration 0041 — reach the table untyped until Lovable regenerates DB types.
const auditTable = () => (supabase as unknown as { from: (t: string) => any }).from("admin_audit_log");

/** Record a security-sensitive admin action. Best-effort — logging must never
 *  block or fail the real action it describes. */
export async function logAudit(orgId: string, action: string, category: AuditCategory) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const actorName = (userData.user?.user_metadata?.full_name as string) || userData.user?.email || "Someone";
    await auditTable().insert({ org_id: orgId, actor_id: userData.user?.id ?? null, actor_name: actorName, action, category });
  } catch {
    // best-effort
  }
}

/** Most recent audit entries for an org, newest first. Fails soft (empty) if unmigrated. */
export async function listAuditLog(orgId: string, limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await auditTable()
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as AuditEntry[]) ?? [];
}
