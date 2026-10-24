import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ForgotPassword from './ForgotPassword';
import ResetPassword from '../ResetPassword';
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(), updateUser: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: mocks } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('@/components/auth/useSocialAuth', () => ({ useSocialAuth: () => ({ signIn: vi.fn(), pending: null }) }));
const show = (element: React.ReactNode) => render(<MemoryRouter><Routes><Route path="/" element={element}/><Route path="/auth/verify-email" element={<p>Confirmation options</p>}/></Routes></MemoryRouter>);
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.getSession.mockResolvedValue({ data: { session: null }, error: null }); });
describe('authentication workflows', () => {
  it('keeps signup usable after an email delivery failure', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: { message: 'Error sending confirmation email' } });
    show(<SignUp/>);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Designer' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'writer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/We couldn't send the email/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: 'https://ordo.inspirarestudio.com/auth/verify-email', data: { full_name: 'Test Designer' } } }));
  });
  it.each([
    { data: { session: null, user: { identities: [] } }, error: null },
    { data: { session: null, user: null }, error: { code: 'user_already_exists', message: 'User already registered' } },
  ])('keeps an existing account on signup with sign-in and reset actions', async (response) => {
    mocks.signUp.mockResolvedValue(response);
    show(<SignUp/>);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Designer' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'writer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('You already have an account')).toBeInTheDocument();
    expect(screen.getByText(/No new confirmation email was sent/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reset password' })).toHaveAttribute('href', '/auth/forgot-password?email=writer%40example.com');
    expect(screen.queryByText('Confirmation options')).toBeNull();
  });
  it('sends a genuinely new signup to confirmation', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null, user: { identities: [{ provider: 'email' }] } }, error: null });
    show(<SignUp/>);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Test Designer' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'writer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'StrongPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Confirmation options')).toBeInTheDocument();
  });
  it('offers verification recovery after an unconfirmed-email sign-in', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    show(<SignIn/>);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'writer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('link', { name: 'Request a new verification email' })).toHaveAttribute('href', '/auth/verify-email?email=writer%40example.com');
  });
  it('restores the sign-in button after a rejected request', async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error('network failure'));
    show(<SignIn/>);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'writer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Network problem/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
  it('recovers from a rejected password-reset email request', async () => {
    mocks.resetPasswordForEmail.mockRejectedValue(new Error('network failure'));
    show(<ForgotPassword/>);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'writer@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/Network problem/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('writer@example.com', { redirectTo: 'https://ordo.inspirarestudio.com/reset-password' });
  });
  it('shows a recovery action instead of spinning forever without a reset session', async () => {
    show(<ResetPassword/>);
    expect(await screen.findByRole('link', { name: 'Request a new reset link' })).toBeInTheDocument();
    expect(screen.queryByText('Verifying your reset link…')).toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
