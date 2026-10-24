#!/usr/bin/env node
/** Run synthetic access fixtures in a rollback transaction against a test database. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const connection = process.env.TEST_DATABASE_URL;
if (!connection) {
  console.error('Set TEST_DATABASE_URL to an isolated migrated test database.');
  process.exit(2);
}
const fixtures = ['access-contract.sql', 'invitation-preparation.sql', 'scoped-invitations.sql'].map(name => readFileSync(new URL(`../supabase/tests/${name}`, import.meta.url), 'utf8')).join("\nRESET ROLE;\nSELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true);\n");
try {
  execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', connection], {
    input: `BEGIN;\n${fixtures}\nROLLBACK;\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
} catch {
  // The connection closing also rolls back an aborted transaction.
  process.exit(1);
}
