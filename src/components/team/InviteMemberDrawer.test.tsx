import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteMemberDrawer } from './InviteMemberDrawer';
afterEach(cleanup);
function show(projects = [{ id: 'ivy', name: 'Ivy Website' }]) {
 const invite=vi.fn().mockResolvedValue(true);
 render(<InviteMemberDrawer open onOpenChange={() => {}} workspaceName="Inspirare" initialRole="client" projects={projects} onInvite={invite} />);
 fireEvent.change(screen.getByRole('textbox', { name: 'Email addresses' }), { target: { value: 'client@example.com' } });
 fireEvent.click(screen.getByRole('button', { name: 'Continue' })); return invite;
}
describe('agency invitation scope', () => {
 it('defaults clients to a project and sends the reviewed scope', () => {
  const invite=show(); expect(screen.getByRole('radio', { name: /A project/ })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Ivy Website')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
  expect(invite).toHaveBeenCalledWith(['client@example.com'],'client',{ projectId: 'ivy' });
 });
 it('blocks a missing project but permits explicit workspace access without sharing all projects', () => {
  const invite=show([]); expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /Client workspace/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Only projects explicitly shared with this client are visible.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
  expect(invite).toHaveBeenCalledWith(['client@example.com'],'client',{ projectId: null });
 });
});
