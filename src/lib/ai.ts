import { supabase } from "./supabase";

export type AiMessage = { role: "user" | "assistant"; content: string };

/** Ask WonderFlow AI (Claude, via the ai-chat edge function) for a reply. */
export async function askAI(
  messages: AiMessage[],
  business?: { name?: string | null; industry?: string | null },
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { messages, business },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error as string);
  return (data?.text as string) ?? "";
}
