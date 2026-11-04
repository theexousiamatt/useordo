#!/usr/bin/env node
/**
 * Canonical S1 checks in two fresh, in-memory PostgreSQL instances.
 * No network or live database. Auth/Storage catalog stubs do not certify the
 * Supabase gateway, real identity sessions, object bytes or signed URL expiry.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const foundation = resolve(root, 'supabase/foundation');
const migrations = readdirSync(resolve(foundation, 'migrations')).filter(name => name.endsWith('.sql')).sort();
const suites = readdirSync(resolve(foundation, 'tests')).filter(name => /^\d.*\.sql$/.test(name)).sort();
if (!migrations.length || !suites.length) throw new Error('Canonical migrations and SQL test suites are required.');
const sql = relative => readFileSync(resolve(foundation, relative), 'utf8');

async function snapshot(db) {
  const { rows } = await db.query(`SELECT jsonb_build_object(
    'organizations',(SELECT jsonb_agg(jsonb_build_array(id,name,slug) ORDER BY id) FROM public.organizations),
    'memberships',(SELECT jsonb_agg(jsonb_build_array(organization_id,user_id,role,status) ORDER BY organization_id,user_id) FROM public.organization_memberships),
    'projects',(SELECT jsonb_agg(jsonb_build_array(id,organization_id,name,ownership,lifecycle,work_context_id) ORDER BY id) FROM public.projects),
    'tasks',(SELECT jsonb_agg(jsonb_build_array(id,organization_id,work_context_id,category) ORDER BY id) FROM public.tasks),
    'contacts',(SELECT jsonb_agg(jsonb_build_array(id,client_organization_id,email,profile_id) ORDER BY id) FROM public.client_contacts)
  ) AS fixtures`);
  return JSON.stringify(rows[0].fixtures);
}

let previousSnapshot;
for (let pass = 1; pass <= 2; pass++) {
  const db = new PGlite();
  let current = 'platform stubs';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL REFERENCES storage.buckets(id),name text NOT NULL,owner uuid,UNIQUE(bucket_id,name));
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,public,storage TO anon,authenticated,service_role;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,service_role;
      GRANT SELECT ON auth.users TO service_role;`);
    for (const name of migrations) {
      current = `migration ${name}`;
      await db.exec(sql(`migrations/${name}`));
    }
    const empty = await db.query('SELECT count(*)::int AS count FROM public.foundation_environment');
    if (empty.rows[0].count !== 0) throw new Error('The migration must not invent an environment identity.');
    current = 'test helpers';
    await db.exec(sql('tests/support.sql'));
    current = 'deterministic synthetic fixtures';
    await db.exec('BEGIN');
    await db.exec(sql('tests/fixtures.sql'));
    await db.exec('COMMIT');
    const first = await snapshot(db);
    await db.exec('BEGIN');
    await db.exec(sql('tests/fixtures.sql'));
    await db.exec('COMMIT');
    if (first !== await snapshot(db)) throw new Error('Reseeding changed logical fixtures or introduced duplicates.');
    if (previousSnapshot && previousSnapshot !== first) throw new Error('Fresh bootstrap changed deterministic logical fixtures.');
    previousSnapshot = first;
    for (const name of suites) {
      current = `suite ${name}`;
      await db.exec('BEGIN');
      const results = await db.exec(sql(`tests/${name}`));
      await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
      await db.exec('ROLLBACK');
      console.log(`pass ${pass}: ${name}: ${JSON.stringify(results.at(-1)?.rows ?? [])}`);
    }
    if (first !== await snapshot(db)) throw new Error('A rollback-only suite changed fixture data.');
    console.log(`pass ${pass}: canonical bootstrap, repeat seed and rollback integrity passed`);
  } catch (error) {
    console.error(`Foundation check failed during ${current}: ${error.message}`);
    process.exitCode = 1;
    break;
  } finally {
    await db.close();
  }
}
if (!process.exitCode) console.log('Canonical S1 SQL checks passed in two fresh isolated PostgreSQL instances. Auth/Storage transport remains a separate runtime check.');
