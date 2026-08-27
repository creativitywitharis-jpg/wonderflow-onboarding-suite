import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Tracks the current auth session, updating on sign-in / sign-out. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Permanently delete the signed-in user's WonderFlow account — their actual
 * login, not just membership in one business. The edge function refuses if
 * they own a business that still has other members (transfer ownership
 * first); businesses they solely own are deleted along with the account.
 */
export async function deleteMyAccount(): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("delete-account", {});
  if (error) return { error: new Error(error.message) };
  if (data?.error) return { error: new Error(data.error as string) };
  return { error: null };
}
