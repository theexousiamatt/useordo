import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvitationInbox } from './InvitationInbox';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:mock.rpc}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'client'},loading:false})}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();});
function show(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><Routes><Route path="/" element={<InvitationInbox/>}/><Route path="/onboarding" element={<p>Agency setup</p>}/></Routes></MemoryRouter></QueryClientProvider>)}
describe('invitation discovery before agency setup',()=>{
 it('shows pending work instead of creating a workspace',async()=>{
  mock.rpc.mockResolvedValue({data:[{token:'invite',workspace_name:'Agency',project_name:'Ivy',role:'client'}],error:null});show();
  expect(await screen.findByRole('link',{name:/Ivy/})).toHaveAttribute('href','/auth/invite?token=invite');
  expect(screen.queryByText('Agency setup')).toBeNull();
 });
 it('fails closed when invitations cannot be checked',async()=>{
  mock.rpc.mockResolvedValue({data:null,error:{message:'offline'}});show();
  expect(await screen.findByRole('button',{name:'Try again'})).toBeEnabled();
  expect(screen.queryByText('Agency setup')).toBeNull();
 });
 it('permits agency setup after a successful empty check',async()=>{
  mock.rpc.mockResolvedValue({data:[],error:null});show();
  expect(await screen.findByText('Agency setup')).toBeInTheDocument();
 });
});
