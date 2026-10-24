import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkspaceInvite from './WorkspaceInvite';
const mock = vi.hoisted(() => ({ invoke: vi.fn(), otp: vi.fn(), refresh: vi.fn(), select: vi.fn(), signOut: vi.fn(), user: null as null | { id: string; email: string } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke }, auth: { signInWithOtp: mock.otp } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mock.user, loading: false, signOut: mock.signOut }) }));
vi.mock('@/hooks/useWorkspace', () => ({ useWorkspace: () => ({ refresh: mock.refresh, selectWorkspace: mock.select }) }));
const invite = { valid: true, status: 'pending', email: 'client@example.com', role: 'client', workspaceId: 'agency', workspaceName: 'Inspirare Studio', inviterName: 'Matthew', projectId: 'project', projectName: 'Ivy Website' };
function show(query = '') { return render(<MemoryRouter initialEntries={['/auth/invite?token=sample' + query]}><Routes><Route path="/auth/invite" element={<WorkspaceInvite />} /><Route path="/client/projects/project" element={<p>Invited project opened</p>} /></Routes></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mock.user = null; mock.invoke.mockResolvedValue({ data: { invite }, error: null }); mock.otp.mockResolvedValue({ error: null }); });
afterEach(cleanup);
describe('invitation-first client journey', () => {
  it('requests an email-bound magic link that returns directly to the invitation, without agency setup', async () => {
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Email me a sign-in link' }));
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(mock.otp).toHaveBeenCalledWith({ email: 'client@example.com', options: { shouldCreateUser: true, emailRedirectTo: 'https://ordo.inspirarestudio.com/auth/invite?token=sample&join=1' } });
    expect(screen.queryByText('Create your workspace')).toBeNull();
    expect(screen.getByRole('button', { name: /Send again in/ })).toBeDisabled();
  });
  it('requires account switching when the signed-in email does not match', async () => {
    mock.user = { id: 'other', email: 'other@example.com' }; show();
    fireEvent.click(await screen.findByRole('button', { name: 'Use the invited email' }));
    await waitFor(() => expect(mock.signOut).toHaveBeenCalledOnce());
    expect(mock.invoke).not.toHaveBeenCalledWith('accept-invitation', expect.objectContaining({ body: expect.objectContaining({ accept: true }) }));
  });
  it('accepts once after email verification and opens the exact project, including already accepted links', async () => {
    mock.user = { id: 'client', email: 'CLIENT@example.com' };
    mock.invoke.mockImplementation((_name, options) => Promise.resolve({ data: options.body.accept ? { workspaceId: 'agency', destination: '/client/projects/project' } : { invite: { ...invite, status: 'accepted' } }, error: null }));
    show('&join=1');
    expect(await screen.findByText('Invited project opened')).toBeInTheDocument();
    expect(mock.select).toHaveBeenCalledWith('agency'); expect(mock.refresh).toHaveBeenCalledOnce();
    expect(mock.invoke.mock.calls.filter(([, args]) => args.body.accept === true)).toHaveLength(1);
    expect(sessionStorage.getItem('ordo:invitation-return')).toBeNull();
  });
  it('offers an expired-link request that notifies the agency instead of silently renewing permissions', async () => {
    mock.invoke.mockResolvedValueOnce({ data: { invite: { ...invite, valid: false, status: 'expired' } } }).mockResolvedValueOnce({ data: { requested: true } });
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Request a new invitation' }));
    expect(await screen.findByText(/agency has been notified in Ordo/)).toBeInTheDocument();
    expect(mock.invoke).toHaveBeenLastCalledWith('accept-invitation', expect.objectContaining({ body: { token: 'sample', action: 'request-renewal' } }));
  });
  it('shows actionable backend access failures without restarting agency signup', async () => {
    mock.user = { id: 'client', email: 'client@example.com' };
    mock.invoke.mockResolvedValueOnce({ data: { invite }, error: null }).mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ error: 'Your access was deactivated. Ask the agency to restore it.' }) } } });
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Open project' }));
    expect(await screen.findByText(/Your access was deactivated/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open project' })).toBeEnabled();
    expect(mock.refresh).not.toHaveBeenCalled();
  });
  it('restores actions after an email failure without claiming it was sent', async () => {
    mock.otp.mockRejectedValue(new Error('network failure')); show();
    fireEvent.click(await screen.findByRole('button', { name: 'Email me a sign-in link' }));
    expect(await screen.findByText(/Network problem/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeEnabled();
    expect(screen.queryByText('Check your inbox')).toBeNull();
  });
});
