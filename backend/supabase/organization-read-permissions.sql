-- Repair projects created without automatic Data API table grants.
-- Existing membership policies remain unchanged; no media or memberships are modified.
begin;
alter table public.organizations enable row level security;
grant select (id, name) on public.organizations to authenticated;
notify pgrst, 'reload schema';
commit;
