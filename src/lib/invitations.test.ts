import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteWorkspacePeople } from './invitations';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mock.rpc } }));
vi.mock('./email', () => ({ sendAppEmail: mock.send }));
beforeEach(() => { vi.clearAllMocks(); });
describe('shared invitation preparation and delivery', () => {
 it('normalizes recipients, skips members and reports partial delivery separately', async () => {
  mock.rpc.mockResolvedValue({ data: [
   { email: 'a@example.com', invitation_id: 'invite-a', outcome: 'created' },
   { email: 'b@example.com', invitation_id: null, outcome: 'member' },
   { email: 'c@example.com', invitation_id: 'invite-c', outcome: 'pending' },
  ], error: null });
  mock.send.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await inviteWorkspacePeople('workspace', [' A@example.com ', 'a@example.com', 'b@example.com', 'c@example.com'], 'client')).toEqual({ invitations: 2, alreadyMembers: 1, emailAccepted: 1, emailUnconfirmed: 1 });
  expect(mock.rpc).toHaveBeenCalledWith('prepare_workspace_invitations', { _workspace_id: 'workspace', _emails: ['a@example.com', 'b@example.com', 'c@example.com'], _role: 'client' });
  expect(mock.send).toHaveBeenCalledTimes(2);
 });
 it('does not send emails after preparation fails', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'Workspace access denied' } });
  await expect(inviteWorkspacePeople('workspace', ['a@example.com'], 'member')).rejects.toThrow('Workspace access denied');
  expect(mock.send).not.toHaveBeenCalled();
 });
 it('does not turn an incomplete response into success', async () => {
  mock.rpc.mockResolvedValue({ data: [], error: null });
  await expect(inviteWorkspacePeople('workspace', ['a@example.com'], 'member')).rejects.toThrow(/confirm every invitation/);
 });
});
