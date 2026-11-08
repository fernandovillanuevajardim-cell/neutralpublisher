import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'

const orgA = '10000000-0000-4000-8000-000000000001'
const orgB = '10000000-0000-4000-8000-000000000002'
const adminA = '20000000-0000-4000-8000-000000000001'
const adminB = '20000000-0000-4000-8000-000000000002'
const editor = '20000000-0000-4000-8000-000000000003'
const device = '30000000-0000-4000-8000-000000000001'
const deviceB = '30000000-0000-4000-8000-000000000002'
const secret = 'a'.repeat(64)
const db = new PGlite()
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create table public.organizations(id uuid primary key, name text default 'Test company');
    create table public.organization_members(organization_id uuid, user_id uuid, role text);
    insert into organizations(id) values ('${orgA}'), ('${orgB}');
    insert into organization_members values ('${orgA}', '${adminA}', 'admin'),
      ('${orgB}', '${adminB}', 'owner'), ('${orgA}', '${editor}', 'editor');
  `)
  const schema = readFileSync('backend/supabase/schema.sql', 'utf8')
  const start = schema.indexOf('create or replace function public.can_admin_org(')
  const end = schema.indexOf('$$;', start) + 3
  await db.exec(schema.slice(start, end))
  const memberStart = schema.indexOf('create or replace function public.is_org_member(')
  await db.exec(schema.slice(memberStart, schema.indexOf('$$;', memberStart) + 3))
  const policyStart = schema.indexOf('create policy "organizations read member"')
  await db.exec(schema.slice(policyStart, schema.indexOf(';', policyStart) + 1))
  const readPermissions = readFileSync('backend/supabase/organization-read-permissions.sql', 'utf8')
  await db.exec(readPermissions)
  await db.exec(readPermissions)
  const migration = readFileSync('backend/supabase/display-control.sql', 'utf8')
  await db.exec(migration)
  await db.exec(migration) // Migration must be safe to reapply.
})
beforeEach(() => db.exec('begin'))
afterEach(() => db.exec('rollback'))
afterAll(() => db.close())
async function as(role: 'anon' | 'authenticated', user = '') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user])
  await db.exec(`set local role ${role}`)
}
async function pulse(org = orgA, key = secret, id = device) {
  const result = await db.query<{ state: string }>('select public.display_heartbeat($1, $2, $3) as state', [org, id, key])
  return result.rows[0].state
}
it('anonymous enrollment defaults to pending and repeated calls reuse one row', async () => {
  await as('anon')
  expect(await pulse()).toBe('pending')
  expect(await pulse()).toBe('pending')
  await as('authenticated', adminA)
  expect((await db.query('select id from display_devices')).rows).toHaveLength(1)
})
it('allows an admin to turn off approval for only their company and restore it later', async () => {
  await as('authenticated', adminA)
  expect((await db.query<{ enabled: boolean }>('select public.get_display_control_enabled($1) as enabled', [orgA])).rows[0].enabled).toBe(true)
  await db.query('select public.set_display_control_enabled($1, false)', [orgA])
  await as('anon')
  expect(await pulse()).toBe('enabled')
  await as('authenticated', adminA)
  expect((await db.query('select id from display_devices')).rows).toHaveLength(0)
  await db.query('select public.set_display_control_enabled($1, true)', [orgA])
  await as('anon')
  expect(await pulse()).toBe('pending')
  expect(await pulse(orgB, secret, deviceB)).toBe('pending')
})
it('does not let visitors change the switch', async () => {
  await as('anon')
  await expect(db.query('select public.set_display_control_enabled($1, false)', [orgA])).rejects.toThrow(/permission denied/)
})
it('does not let editors change the switch', async () => {
  await as('authenticated', editor)
  await expect(db.query('select public.set_display_control_enabled($1, false)', [orgA])).rejects.toThrow(/Not allowed/)
})
it('does not let another company change the switch', async () => {
  await as('authenticated', adminB)
  await expect(db.query('select public.set_display_control_enabled($1, false)', [orgA])).rejects.toThrow(/Not allowed/)
})
it('allows the organization dropdown query but only for the authenticated member company', async () => {
  await as('authenticated', adminA)
  const result = await db.query<{ id: string }>('select id, name from organizations order by name')
  expect(result.rows.map((r) => r.id)).toEqual([orgA])
  await as('authenticated', adminB)
  expect((await db.query<{ id: string }>('select id, name from organizations')).rows.map((r) => r.id)).toEqual([orgB])
})
it('also allows editors to see their company without granting admin access', async () => {
  await as('authenticated', editor)
  expect((await db.query<{ id: string }>('select id, name from organizations')).rows.map((r) => r.id)).toEqual([orgA])
})
it('does not list organizations to anonymous visitors', async () => {
  await as('anon')
  await expect(db.query('select id, name from organizations')).rejects.toThrow(/permission denied/)
})
it('does not grant organization writes along with the read repair', async () => {
  await as('authenticated', adminA)
  await expect(db.query("update organizations set name = 'Changed'")).rejects.toThrow(/permission denied/)
})
it('anonymous devices cannot read the device list', async () => {
  await as('anon')
  await expect(db.query('select id from display_devices')).rejects.toThrow(/permission denied/)
})
it('anonymous devices cannot authorize themselves', async () => {
  await as('anon'); await pulse()
  await expect(db.query('update display_devices set enabled = true')).rejects.toThrow(/permission denied/)
})
it('rejects the wrong secret', async () => {
  await as('anon'); await pulse()
  await expect(pulse(orgA, 'b'.repeat(64))).rejects.toThrow(/Invalid device credentials/)
})
it('rejects cross-organization use of a device identity', async () => {
  await as('anon'); await pulse()
  await expect(pulse(orgB)).rejects.toThrow(/Invalid device credentials/)
})
it('only its organization admin can approve or disable a device', async () => {
  await as('anon'); await pulse()
  await as('authenticated', adminB)
  expect((await db.query('select id from display_devices')).rows).toHaveLength(0)
  expect((await db.query('update display_devices set enabled = true returning id')).rows).toHaveLength(0)
  await as('authenticated', editor)
  expect((await db.query('update display_devices set enabled = true returning id')).rows).toHaveLength(0)
  await as('authenticated', adminA)
  expect((await db.query('update display_devices set enabled = true returning id')).rows).toHaveLength(1)
  await as('anon'); expect(await pulse()).toBe('enabled')
  await as('authenticated', adminA)
  await db.query('update display_devices set enabled = false')
  await as('anon'); expect(await pulse()).toBe('disabled')
  expect(await pulse()).toBe('disabled')
})
it('does not expose the device secret hash even to admins', async () => {
  await as('authenticated', adminA)
  await expect(db.query('select secret_hash from display_devices')).rejects.toThrow(/permission denied/)
})
it('does not allow changing device ownership', async () => {
  await as('authenticated', adminA)
  await expect(db.query('update display_devices set organization_id = $1', [orgB])).rejects.toThrow(/permission denied/)
})
it('bounds anonymous enrollment to 100 devices per organization', async () => {
  await db.exec(`insert into display_devices(id, organization_id, name, secret_hash)
    select gen_random_uuid(), '${orgA}', 'test', sha256('test'::bytea) from generate_series(1,100)`)
  await as('anon')
  await expect(pulse()).rejects.toThrow(/Device limit reached/)
})
