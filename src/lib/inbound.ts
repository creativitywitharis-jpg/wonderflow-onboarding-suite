import { supabase } from "./supabase";

/** The public endpoint external forms/websites POST leads to, for a given key. */
export function inboundUrl(key: string): string {
  const base = (import.meta as { env?: { VITE_SUPABASE_URL?: string } }).env?.VITE_SUPABASE_URL ?? "";
  return `${base}/functions/v1/inbound?key=${key}`;
}

/** Read the org's current ingest key (null if the form endpoint is off). */
export async function getIngestKey(orgId: string): Promise<string | null> {
  const { data } = await supabase.from("organizations").select("ingest_key").eq("id", orgId).maybeSingle();
  return (data as { ingest_key?: string | null } | null)?.ingest_key ?? null;
}

/** Turn on (or rotate) the form endpoint — owner/admin only, via RLS. */
export async function enableIngest(orgId: string): Promise<{ key: string | null; error: Error | null }> {
  const key = crypto.randomUUID();
  const { error } = await supabase.from("organizations").update({ ingest_key: key }).eq("id", orgId);
  return { key: error ? null : key, error: error ? new Error(error.message) : null };
}

/** Disable the form endpoint (any existing embeds stop working). */
export async function disableIngest(orgId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("organizations").update({ ingest_key: null }).eq("id", orgId);
  return { error: error ? new Error(error.message) : null };
}
