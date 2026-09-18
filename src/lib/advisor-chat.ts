import { supabase } from "./supabase";

export type AdvisorMsg = { id: string; conversation_id: string; role: "user" | "ai"; text: string; created_at: string };
export type ConversationSummary = { conversationId: string; title: string; updatedAt: string };

const COLS = "id,conversation_id,role,text,created_at";
const table = () => supabase.from("advisor_messages");

/** This person's own past conversations for an org, most recently active first. */
export async function listConversations(orgId: string): Promise<ConversationSummary[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: true }).limit(300);
  if (error) return [];
  const rows = (data as AdvisorMsg[]) ?? [];
  const byConv = new Map<string, AdvisorMsg[]>();
  for (const r of rows) {
    const list = byConv.get(r.conversation_id) ?? [];
    list.push(r);
    byConv.set(r.conversation_id, list);
  }
  const summaries: ConversationSummary[] = [];
  for (const [id, msgs] of byConv) {
    const firstUser = msgs.find((m) => m.role === "user");
    summaries.push({ conversationId: id, title: firstUser ? firstUser.text.slice(0, 60) : "New conversation", updatedAt: msgs[msgs.length - 1].created_at });
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Every message in one conversation, oldest first. */
export async function listConversationMessages(orgId: string, conversationId: string): Promise<AdvisorMsg[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) return [];
  return (data as AdvisorMsg[]) ?? [];
}

/** Record one turn of a conversation. Best-effort — never blocks the chat itself. */
export async function saveAdvisorMessage(orgId: string, conversationId: string, role: "user" | "ai", text: string) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await table().insert({ org_id: orgId, user_id: userData.user.id, conversation_id: conversationId, role, text });
  } catch {
    // best-effort
  }
}
