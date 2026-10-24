import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import VerifyEmail from './VerifyEmail';

const mocks = vi.hoisted(() => ({
  auth: { user: null as null | { email_confirmed_at: string }, loading: false },
  resend: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { resend: mocks.resend } } }));
function show(path = '/auth/verify-email') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/auth/verify-email" element={<VerifyEmail />} />
    <Route path="/" element={<p>Workspace destination</p>} />
  </Routes></MemoryRouter>);
}
afterEach(cleanup);
beforeEach(() => {
  mocks.auth = { user: null, loading: false };
  mocks.resend.mockReset();
  window.history.replaceState({}, '', '/');
});
describe('email confirmation recovery', () => {
  it('waits for session restoration before showing recovery controls', () => {
    mocks.auth.loading = true;
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Completing email verification');
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).toBeNull();
  });
  it('routes a confirmed session through the existing workspace guard', async () => {
    mocks.auth.user = { email_confirmed_at: '2026-10-24' };
    show();
    expect(await screen.findByText('Workspace destination')).toBeInTheDocument();
  });
  it('explains an expired link and never resends to a placeholder address', () => {
    window.history.replaceState({}, '', '/auth/verify-email#error=access_denied&error_code=otp_expired');
    show();
    expect(screen.getByText(/This verification link is invalid/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeDisabled();
    expect(window.location.hash).toBe('');
  });
  it('resends to the configured live callback and handles network rejection', async () => {
    mocks.resend.mockRejectedValue(new Error('network failure'));
    show('/auth/verify-email?email=writer%40example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));
    await waitFor(() => expect(mocks.resend).toHaveBeenCalledWith({
      type: 'signup', email: 'writer@example.com',
      options: { emailRedirectTo: 'https://ordo.inspirarestudio.com/auth/verify-email' },
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled());
  });
});
