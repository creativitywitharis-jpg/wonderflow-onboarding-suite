delete from public.memberships m
where not exists (select 1 from public.profiles p where p.id = m.user_id);

do $$ begin
  alter table public.memberships
    add constraint memberships_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
exception when duplicate_object then null; end $$;