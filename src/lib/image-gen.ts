import { supabase } from "./supabase";

/** Generate an image from a prompt via OpenAI (dall-e-3), returned as a data: URL. Paid-plan orgs only — enforced server-side too. */
export async function generateImage(orgId: string, prompt: string): Promise<{ dataUrl: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("generate-image", { body: { orgId, prompt } });
  if (error) return { dataUrl: null, error: error.message };
  if (data?.error) return { dataUrl: null, error: data.error as string };
  return { dataUrl: (data?.dataUrl as string) ?? null, error: null };
}
