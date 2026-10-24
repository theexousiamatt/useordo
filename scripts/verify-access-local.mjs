#!/usr/bin/env node
/** Isolated PostgreSQL regression suite. No network, live database, email or storage service.
 * Supabase auth/storage platform tables are represented locally. pg_net, cron,
 * vault and pgmq transports are unavailable and are NOT tested by this runner.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite({extensions:{pgcrypto}});
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
GRANT USAGE ON SCHEMA auth,public,storage TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,service_role;
GRANT SELECT ON auth.users TO service_role;
CREATE PUBLICATION supabase_realtime;`);
const dir = process.cwd()+'/supabase/migrations/';
for (const file of readdirSync(dir).sort()) {
 try { let sql=readFileSync(dir+file,'utf8'); if(file.includes('email_infra')) sql=sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;[\s\S]*?CREATE EXTENSION IF NOT EXISTS pgmq;/,'-- Queue extensions unavailable in isolated runtime; queue transport not tested.'); await db.exec(sql); }
 catch(e) { console.error('Migration failed:', file, e.message); process.exit(1); }
}
console.log('Repository schema/access migrations applied to isolated PostgreSQL (queue transport extensions excluded).');
for (const name of ['access-contract.sql','invitation-preparation.sql','scoped-invitations.sql']) {
 try { await db.exec('BEGIN;'); const rows=await db.exec(readFileSync(process.cwd()+'/supabase/tests/'+name,'utf8')); console.log(name,JSON.stringify(rows.at(-1)?.rows)); await db.exec('ROLLBACK;'); }
 catch(e) { console.error(name,e.message);process.exit(1); }
}
await db.close();
