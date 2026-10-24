import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendAppEmail } from './email';
const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
beforeEach(() => vi.clearAllMocks());
describe('email acceptance reporting', () => {
 it('requires explicit server acceptance, not just a successful HTTP response', async () => {
  mock.invoke.mockResolvedValue({ data: { success: false }, error: null });
  expect(await sendAppEmail({ template: 'workspace-invitation', entityId: 'invite', idempotencyKey: 'invite-key' })).toBe(false);
 });
 it('accepts a server-deduplicated previously accepted message', async () => {
  mock.invoke.mockResolvedValue({ data: { success: true, alreadySent: true }, error: null });
  expect(await sendAppEmail({ template: 'workspace-invitation', entityId: 'invite', idempotencyKey: 'invite-key' })).toBe(true);
 });
});
