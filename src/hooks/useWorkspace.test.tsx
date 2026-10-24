import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceProvider, useWorkspace } from './useWorkspace';
const mock = vi.hoisted(() => ({ auth: { user: { id: 'account-a' }, session: { access_token: 'token-a' }, loading: false }, invoke: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mock.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
function Probe() {
 const state = useWorkspace();
 return <><p>{state.loading ? 'loading' : state.error ? 'failed' : state.currentWorkspace?.name ?? 'empty'}</p><button onClick={() => void state.refresh()}>Retry</button></>;
}
const tree = () => <WorkspaceProvider><Probe/></WorkspaceProvider>;
afterEach(cleanup);
beforeEach(() => { mock.auth = { user: { id: 'account-a' }, session: { access_token: 'token-a' }, loading: false }; mock.invoke.mockReset(); localStorage.clear(); });
const workspace = (name: string) => ({ data: { workspaces: [{ id: name, name, slug: name, owner_id: 'account-a', role: 'owner', type: 'agency' }] }, error: null });
describe('workspace recovery and isolation', () => {
 it('recovers after a rejected request rather than remaining on loading', async () => {
  mock.invoke.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(workspace('Recovered workspace'));
  render(tree());
  expect(await screen.findByText('failed')).toBeInTheDocument();
  act(() => screen.getByText('Retry').click());
  expect(await screen.findByText('Recovered workspace')).toBeInTheDocument();
 });
 it('does not treat a malformed response as a genuinely empty account', async () => {
  mock.invoke.mockResolvedValue({ data: {}, error: null }); render(tree());
  expect(await screen.findByText('failed')).toBeInTheDocument();
 });
 it('cancels an earlier request and ignores its late response', async () => {
  let finish!: (value: ReturnType<typeof workspace>) => void;
  mock.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(workspace('Newest workspace'));
  render(tree());
  await waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
  const signal = mock.invoke.mock.calls[0][1].signal as AbortSignal;
  act(() => screen.getByText('Retry').click());
  expect(await screen.findByText('Newest workspace')).toBeInTheDocument();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(workspace('Stale workspace')));
  expect(screen.queryByText('Stale workspace')).toBeNull();
 });
 it('remounts account state immediately and ignores the previous identity request', async () => {
  let finish!: (value: ReturnType<typeof workspace>) => void;
  mock.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(workspace('Account B workspace'));
  const view = render(tree());
  await waitFor(() => expect(mock.invoke).toHaveBeenCalledTimes(1));
  mock.auth = { ...mock.auth, user: { id: 'account-b' }, session: { access_token: 'token-b' } };
  view.rerender(tree());
  expect(await screen.findByText('Account B workspace')).toBeInTheDocument();
  await act(async () => finish(workspace('Account A workspace')));
  expect(screen.queryByText('Account A workspace')).toBeNull();
 });
});
