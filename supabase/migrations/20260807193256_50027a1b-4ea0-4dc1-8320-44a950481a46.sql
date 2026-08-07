CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  industry text,
  enabled_modules text[] NOT NULL DEFAULT '{}',
  plan text NOT NULL DEFAULT 'starter',
  health_score integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  email text,
  tier text NOT NULL DEFAULT 'Standard',
  sentiment text NOT NULL DEFAULT 'Neutral',
  ltv numeric NOT NULL DEFAULT 0,
  health integer NOT NULL DEFAULT 70,
  orders integer NOT NULL DEFAULT 0,
  since date,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org_id AND m.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org_id AND m.user_id = _user_id AND m.role = ANY(_roles))
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "Users can create organizations" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and admins can update their organization" ON public.organizations
  FOR UPDATE TO authenticated USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "Owners can delete their organization" ON public.organizations
  FOR DELETE TO authenticated USING (public.has_org_role(id, auth.uid(), ARRAY['owner']));

CREATE POLICY "Members can view memberships of their orgs" ON public.memberships
  FOR SELECT TO authenticated USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Owners and admins can add members" ON public.memberships
  FOR INSERT TO authenticated WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "Owners and admins can update members" ON public.memberships
  FOR UPDATE TO authenticated USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));
CREATE POLICY "Owners and admins can remove members" ON public.memberships
  FOR DELETE TO authenticated USING (public.has_org_role(org_id, auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "Members can view org customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Members can add org customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Members can update org customers" ON public.customers
  FOR UPDATE TO authenticated USING (public.is_org_member(org_id, auth.uid()))
  WITH CHECK (public.is_org_member(org_id, auth.uid()));
CREATE POLICY "Members can delete org customers" ON public.customers
  FOR DELETE TO authenticated USING (public.is_org_member(org_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.add_org_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (NEW.id, COALESCE(NEW.created_by, auth.uid()), 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_add_owner
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.add_org_owner();