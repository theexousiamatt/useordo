import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './useAuth';
const mock = vi.hoisted(() => ({ listener: null as null | ((event: string, session: unknown) => void) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
 onAuthStateChange: (listener: typeof mock.listener) => { mock.listener = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
 getSession: () => Promise.resolve({ data: { session: null } }), signOut: vi.fn(),
} } }));
function Probe() { return <p>{useAuth().user?.id ?? 'signed out'}</p>; }
afterEach(cleanup);
it('clears private query/mutation caches on identity change but retains cache on token refresh', async () => {
 const client = new QueryClient();
 render(<QueryClientProvider client={client}><AuthProvider><Probe/></AuthProvider></QueryClientProvider>);
 await act(async () => undefined);
 act(() => mock.listener?.('SIGNED_IN', { user: { id: 'a' } }));
 client.setQueryData(['private-project'], { name: 'Account A private data' });
 act(() => mock.listener?.('TOKEN_REFRESHED', { user: { id: 'a' }, access_token: 'new-token' }));
 expect(client.getQueryData(['private-project'])).toBeDefined();
 act(() => mock.listener?.('SIGNED_IN', { user: { id: 'b' } }));
 expect(screen.getByText('b')).toBeInTheDocument();
 expect(client.getQueryData(['private-project'])).toBeUndefined();
 client.setQueryData(['b-private'], 'private');
 act(() => mock.listener?.('SIGNED_OUT', null));
 expect(client.getQueryData(['b-private'])).toBeUndefined();
});
