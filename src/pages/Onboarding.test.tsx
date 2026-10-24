import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Onboarding from './Onboarding';
const mock = vi.hoisted(() => ({ invite: vi.fn(), refresh: vi.fn(), select: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' }, loading: false }) }));
vi.mock('@/hooks/useWorkspace', () => ({ useWorkspace: () => ({ workspaces: [], loading: false, resolved: true, error: null, refresh: mock.refresh, selectWorkspace: mock.select }) }));
vi.mock('@/lib/invitations', () => ({ inviteWorkspacePeople: mock.invite }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const success = { invitations: 1, alreadyMembers: 0, emailAccepted: 1, emailUnconfirmed: 0 };
function show() { return render(<MemoryRouter initialEntries={['/onboarding']}><Routes><Route path="/onboarding" element={<Onboarding/>}/><Route path="/" element={<p>Workspace opened</p>}/></Routes></MemoryRouter>); }
afterEach(cleanup);
beforeEach(() => {
 vi.clearAllMocks(); localStorage.clear();
 localStorage.setItem('ordo:onboarding:test-user', JSON.stringify({ step: 8, name: 'My studio', type: 'agency', workspaceId: 'workspace', team: ['team@example.com'], clients: ['client@example.com'], project: { name: '', client: '', description: '' } }));
 mock.refresh.mockResolvedValue(undefined);
});
describe('onboarding invitation completion', () => {
 it('creates real member/client invitations before completing setup', async () => {
  mock.invite.mockResolvedValue(success); show();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Ordo' }));
  expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
  expect(mock.invite).toHaveBeenNthCalledWith(1, 'workspace', ['team@example.com'], 'member');
  expect(mock.invite).toHaveBeenNthCalledWith(2, 'workspace', ['client@example.com'], 'client');
  expect(localStorage.getItem('ordo:onboarding:test-user')).toBeNull();
 });
 it('preserves setup and gives retry after invitation creation fails', async () => {
  mock.invite.mockRejectedValue(new Error('Workspace access denied')); show();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Ordo' }));
  expect(await screen.findByText(/Workspace access denied/)).toBeInTheDocument();
  expect(mock.refresh).not.toHaveBeenCalled();
  expect(localStorage.getItem('ordo:onboarding:test-user')).not.toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enter Ordo' })).toBeEnabled());
 });
 it('requires an explicit choice when email acceptance is unconfirmed', async () => {
  mock.invite.mockResolvedValueOnce({ ...success, emailAccepted: 0, emailUnconfirmed: 1 }).mockResolvedValueOnce(success);
  show(); fireEvent.click(screen.getByRole('button', { name: 'Enter Ordo' }));
  const later = await screen.findByRole('button', { name: 'Enter Ordo and manage invitations later' });
  expect(mock.refresh).not.toHaveBeenCalled();
  fireEvent.click(later);
  expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
  expect(mock.invite).toHaveBeenCalledTimes(2);
 });
});
