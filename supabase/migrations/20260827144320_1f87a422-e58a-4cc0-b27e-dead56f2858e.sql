-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Help conversation history (private per person) + a real
-- self-service "leave this business" action.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.help_messages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('user','ai')),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists help_messages_user_idx on public.help_messages (org_id, user_id, created_at);

grant select, insert, update, delete on public.help_messages to authenticated;
grant all on public.help_messages to service_role;

alter table public.help_messages enable row level security;

-- Private to the person who asked — not visible to other org members,
-- including owners/admins.
drop policy if exists help_messages_select on public.help_messages;
create policy help_messages_select on public.help_messages
  for select using (user_id = auth.uid());

drop policy if exists help_messages_insert on public.help_messages;
create policy help_messages_insert on public.help_messages
  for insert with check (user_id = auth.uid() and public.is_org_member(org_id));

-- ── Leave this business ─────────────────────────────────────────────────
-- A member removes their own access. RLS on memberships restricts writes to
-- owner/admin, so a regular member can't delete their own row directly —
-- this SECURITY DEFINER function lets anyone remove exactly their own
-- membership, and only their own, while blocking the owner (leaving would
-- orphan the business with no one able to manage it).
create or replace function public.leave_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  my_role text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select role into my_role from public.memberships where org_id = p_org_id and user_id = uid;
  if my_role is null then
    raise exception 'You are not a member of this organization';
  end if;
  if my_role = 'owner' then
    raise exception 'Owners cannot leave their own business — delete the business instead if you want to close the account.';
  end if;

  delete from public.memberships where org_id = p_org_id and user_id = uid;
end;
$$;

revoke execute on function public.leave_organization(uuid) from anon, public;
grant  execute on function public.leave_organization(uuid) to authenticated;