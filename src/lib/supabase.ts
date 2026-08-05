import { createClient } from "@supabase/supabase-js";

// The publishable (anon) key is safe to expose in the client — security is
// enforced by Row-Level Security in the database. Env vars override the
// defaults so the same code works locally and on Lovable/production.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://figlhaocxadajycnnvfw.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_b79MxwPojG0oPvpulMhfjQ_XIx3Qi7_";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
