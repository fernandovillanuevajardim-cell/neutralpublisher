-- Run after schema.sql. No media or existing playlists are modified.
begin;

alter table public.organizations
  add column if not exists display_control_enabled boolean not null default true;

create table if not exists public.display_devices (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  secret_hash bytea not null,
  enabled boolean default null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists display_devices_org_idx on public.display_devices(organization_id);
alter table public.display_devices enable row level security;
revoke all on public.display_devices from anon, authenticated;
grant select (id, organization_id, name, enabled, last_seen_at, created_at)
  on public.display_devices to authenticated;
grant update (name, enabled) on public.display_devices to authenticated;

drop policy if exists "display admins read" on public.display_devices;
create policy "display admins read" on public.display_devices for select to authenticated
  using (public.can_admin_org(organization_id));
drop policy if exists "display admins update" on public.display_devices;
create policy "display admins update" on public.display_devices for update to authenticated
  using (public.can_admin_org(organization_id))
  with check (public.can_admin_org(organization_id));

-- A device can only announce itself and read its own authorization, never enable itself.
create or replace function public.display_heartbeat(org_id uuid, device_id uuid, device_secret text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  device public.display_devices%rowtype;
  hashed bytea;
  control_enabled boolean;
begin
  if device_secret is null or device_secret !~ '^[a-f0-9]{64}$' or device_id is null or org_id is null then
    raise exception 'Invalid device credentials';
  end if;
  select display_control_enabled into control_enabled from public.organizations where id = org_id;
  if not found then raise exception 'Organization unavailable'; end if;
  if not control_enabled then return 'enabled'; end if;
  hashed := pg_catalog.sha256(pg_catalog.convert_to(device_secret, 'UTF8'));
  select * into device from public.display_devices where id = device_id;
  if not found then
    -- Serialize enrollment per organization; anonymous callers cannot create unlimited rows.
    perform 1 from public.organizations where id = org_id for update;
    if not found then raise exception 'Organization unavailable'; end if;
    select * into device from public.display_devices where id = device_id;
    if not found then
      if (select count(*) from public.display_devices where organization_id = org_id) >= 100 then
        raise exception 'Device limit reached. Contact administrator.';
      end if;
      insert into public.display_devices (id, organization_id, name, secret_hash)
        values (device_id, org_id, 'Pantalla ' || left(device_id::text, 8), hashed)
        returning * into device;
    end if;
  end if;
  if device.organization_id <> org_id or device.secret_hash <> hashed then
    raise exception 'Invalid device credentials';
  end if;
  update public.display_devices set last_seen_at = now()
    where id = device_id and last_seen_at < now() - interval '4 minutes';
  return case when device.enabled is null then 'pending'
    when device.enabled then 'enabled' else 'disabled' end;
end;
$$;
revoke all on function public.display_heartbeat(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.display_heartbeat(uuid, uuid, text) to anon, authenticated;

create or replace function public.get_display_control_enabled(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select display_control_enabled from public.organizations
    where id = org_id and public.can_admin_org(org_id);
$$;
revoke all on function public.get_display_control_enabled(uuid) from public, anon, authenticated;
grant execute on function public.get_display_control_enabled(uuid) to authenticated;

create or replace function public.set_display_control_enabled(org_id uuid, control_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if control_enabled is null or not public.can_admin_org(org_id) then
    raise exception 'Not allowed to change display control';
  end if;
  update public.organizations set display_control_enabled = control_enabled where id = org_id;
  if not found then raise exception 'Organization unavailable'; end if;
  return control_enabled;
end;
$$;
revoke all on function public.set_display_control_enabled(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_display_control_enabled(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
