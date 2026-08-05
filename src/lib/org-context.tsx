import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { getActiveOrgId, getMyOrgs, setActiveOrgId, type OrgRow } from "./org";
import { useAuth } from "./use-auth";

type OrgContextValue = {
  signedIn: boolean;
  authLoading: boolean;
  org: OrgRow | null;
  orgs: OrgRow[];
  role: string | null;
  loading: boolean;
  userName: string;
  userEmail: string;
  refresh: () => Promise<void>;
  switchOrg: (id: string) => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session, user, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setOrg(null);
      setRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await getMyOrgs();
    setOrgs(list);
    const activeId = getActiveOrgId();
    const active = list.find((o) => o.id === activeId) ?? list[0] ?? null;
    setOrg(active);
    if (active) {
      setActiveOrgId(active.id);
      const { data } = await supabase
        .from("memberships")
        .select("role")
        .eq("org_id", active.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setRole((data as { role?: string } | null)?.role ?? null);
    } else {
      setRole(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const switchOrg = useCallback(
    (id: string) => {
      setActiveOrgId(id);
      void load();
    },
    [load],
  );

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const userName = meta.full_name || meta.name || user?.email?.split("@")[0] || "You";

  return (
    <OrgContext.Provider
      value={{
        signedIn: !!session,
        authLoading,
        org,
        orgs,
        role,
        loading,
        userName,
        userEmail: user?.email ?? "",
        refresh: load,
        switchOrg,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within <OrgProvider>");
  return ctx;
}
