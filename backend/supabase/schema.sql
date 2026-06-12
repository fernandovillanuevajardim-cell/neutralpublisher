create extension if not exists pgcrypto;

do $$ begin
  create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.media_kind as enum ('image', 'video');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.screen_status as enum ('online', 'offline', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.fit_mode as enum ('cover', 'contain');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transition_name as enum ('fade', 'slide_x', 'slide_y', 'zoom', 'flip', 'blur');
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  pairing_code text unique,
  device_kind text not null default 'web',
  resolution_width integer,
  resolution_height integer,
  status public.screen_status not null default 'unknown',
  last_seen_at timestamptz,
  active_playlist_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.media_kind not null,
  name text not null,
  storage_path text not null,
  public_url text,
  mime_type text not null,
  size_bytes bigint not null default 0,
  width integer,
  height integer,
  duration_seconds numeric(10, 2),
  checksum text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slide_seconds integer not null default 8,
  transition public.transition_name not null default 'fade',
  fit public.fit_mode not null default 'cover',
  video_muted boolean not null default true,
  show_clock boolean not null default true,
  show_badge boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  position integer not null,
  duration_seconds integer,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (playlist_id, position)
);

alter table public.screens
  drop constraint if exists screens_active_playlist_fk;

alter table public.screens
  add constraint screens_active_playlist_fk
  foreign key (active_playlist_id)
  references public.playlists(id)
  on delete set null;

create table if not exists public.screen_events (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_organization_id_idx on public.organization_members(organization_id);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists branches_organization_id_idx on public.branches(organization_id);
create index if not exists screens_branch_id_idx on public.screens(branch_id);
create index if not exists screens_pairing_code_idx on public.screens(pairing_code);
create index if not exists media_assets_organization_id_idx on public.media_assets(organization_id);
create index if not exists playlists_organization_id_idx on public.playlists(organization_id);
create index if not exists playlist_items_playlist_id_position_idx on public.playlist_items(playlist_id, position);
create index if not exists screen_events_screen_id_created_at_idx on public.screen_events(screen_id, created_at desc);

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.can_admin_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.branch_org_id(target_branch_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.branches where id = target_branch_id;
$$;

create or replace function public.playlist_org_id(target_playlist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.playlists where id = target_playlist_id;
$$;

create or replace function public.media_org_id(target_media_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.media_assets where id = target_media_id;
$$;

create or replace function public.add_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.set_organization_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_set_created_by on public.organizations;
create trigger organizations_set_created_by
before insert on public.organizations
for each row
execute function public.set_organization_created_by();

drop trigger if exists organizations_add_owner on public.organizations;
create trigger organizations_add_owner
after insert on public.organizations
for each row
execute function public.add_organization_owner();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.branches enable row level security;
alter table public.screens enable row level security;
alter table public.media_assets enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.screen_events enable row level security;

drop policy if exists "organizations read member" on public.organizations;
drop policy if exists "organizations insert authenticated" on public.organizations;
drop policy if exists "organizations update manager" on public.organizations;
drop policy if exists "organization_members read member" on public.organization_members;
drop policy if exists "organization_members manage owner admin" on public.organization_members;
drop policy if exists "branches read member" on public.branches;
drop policy if exists "branches manage editor" on public.branches;
drop policy if exists "screens read member" on public.screens;
drop policy if exists "screens manage editor" on public.screens;
drop policy if exists "media read member" on public.media_assets;
drop policy if exists "media manage editor" on public.media_assets;
drop policy if exists "playlists read member" on public.playlists;
drop policy if exists "playlists manage editor" on public.playlists;
drop policy if exists "playlist_items read member" on public.playlist_items;
drop policy if exists "playlist_items manage editor" on public.playlist_items;
drop policy if exists "screen_events read member" on public.screen_events;
drop policy if exists "screen_events insert member" on public.screen_events;

create policy "organizations read member"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "organizations insert authenticated"
on public.organizations
for insert
to authenticated
with check (auth.uid() is not null);

create policy "organizations update manager"
on public.organizations
for update
to authenticated
using (public.can_manage_org(id))
with check (public.can_manage_org(id));

create policy "organization_members read member"
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "organization_members manage owner admin"
on public.organization_members
for all
to authenticated
using (public.can_admin_org(organization_id))
with check (public.can_admin_org(organization_id));

create policy "branches read member"
on public.branches
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "branches manage editor"
on public.branches
for all
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create policy "screens read member"
on public.screens
for select
to authenticated
using (public.is_org_member(public.branch_org_id(branch_id)));

create policy "screens manage editor"
on public.screens
for all
to authenticated
using (public.can_manage_org(public.branch_org_id(branch_id)))
with check (public.can_manage_org(public.branch_org_id(branch_id)));

create policy "media read member"
on public.media_assets
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "media manage editor"
on public.media_assets
for all
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create policy "playlists read member"
on public.playlists
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "playlists manage editor"
on public.playlists
for all
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create policy "playlist_items read member"
on public.playlist_items
for select
to authenticated
using (public.is_org_member(public.playlist_org_id(playlist_id)));

create policy "playlist_items manage editor"
on public.playlist_items
for all
to authenticated
using (
  public.can_manage_org(public.playlist_org_id(playlist_id))
  and public.playlist_org_id(playlist_id) = public.media_org_id(media_asset_id)
)
with check (
  public.can_manage_org(public.playlist_org_id(playlist_id))
  and public.playlist_org_id(playlist_id) = public.media_org_id(media_asset_id)
);

create policy "screen_events read member"
on public.screen_events
for select
to authenticated
using (
  public.is_org_member(
    public.branch_org_id((select branch_id from public.screens where id = screen_id))
  )
);

create policy "screen_events insert member"
on public.screen_events
for insert
to authenticated
with check (
  public.is_org_member(
    public.branch_org_id((select branch_id from public.screens where id = screen_id))
  )
);
