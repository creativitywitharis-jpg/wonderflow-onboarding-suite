import { supabase } from "./supabase";

export type HelpMessage = { id: string; role: "user" | "ai"; text: string; created_at: string };

const COLS = "id,role,text,created_at";
// Ships in migration 0042 — reach the table untyped until Lovable regenerates DB types.
const helpTable = () => (supabase as unknown as { from: (t: string) => any }).from("help_messages");

/** This person's own Help conversation for an org, oldest first — private, not visible to anyone else. */
export async function listHelpMessages(orgId: string): Promise<HelpMessage[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await helpTable()
    .select(COLS)
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return [];
  return (data as HelpMessage[]) ?? [];
}

/** Record one turn of the Help conversation. Best-effort — never blocks the chat itself. */
export async function saveHelpMessage(orgId: string, role: "user" | "ai", text: string) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await helpTable().insert({ org_id: orgId, user_id: userData.user.id, role, text });
  } catch {
    // best-effort
  }
}
