import * as React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@10.0.16';
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts';
import { buildAppUrl, inviteUrl, projectUrl } from '../_shared/app-url.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  let deliveryId: string | undefined;
  let smtpAttempted = false;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return reply({ error: 'Authentication required' }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: 'Authentication required' }, 401);
    const body = await req.json().catch(() => null);
    if (!body || !uuid.test(body.entityId ?? '') || !TEMPLATES[body.templateName]) return reply({ error: 'Valid template and entityId are required' }, 400);
    const templateName = body.templateName as string;
    const entityId = body.entityId as string;
    const actor = auth.user.id;
    let workspaceId = '';
    let recipient = '';
    let eventKey = '';
    let data: Record<string, unknown> = {};
    const nameFor = async (id: string) => (await admin.from('profiles').select('full_name').eq('id', id).maybeSingle()).data?.full_name ?? 'A teammate';
    const emailFor = async (id: string) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user?.email_confirmed_at) throw new Error('Recipient is unavailable');
      return data.user.email ?? '';
    };
    if (templateName === 'workspace-invitation') {
      const { data: invite } = await admin.from('workspace_invitations').select('*').eq('id', entityId).maybeSingle();
      if (!invite) return reply({ error: 'Invitation unavailable' }, 403);
      const { data: allowed } = await admin.rpc('can_manage_workspace', { _workspace_id: invite.workspace_id, _user_id: actor });
      if (!allowed || invite.status !== 'pending' || Date.parse(invite.expires_at) <= Date.now()) return reply({ error: 'Invitation access denied' }, 403);
      const { data: ws } = await admin.from('workspaces').select('name').eq('id', invite.workspace_id).single();
      workspaceId = invite.workspace_id;
      recipient = invite.email;
      eventKey = `invite:${invite.id}:${invite.updated_at}`;
      data = { inviterName: await nameFor(actor), workspaceName: ws?.name, role: invite.role, acceptUrl: inviteUrl(invite.token) };
    } else if (templateName === 'task-assigned') {
      if (!uuid.test(body.recipientId ?? '')) return reply({ error: 'recipientId is required' }, 400);
      const { data: task } = await admin.from('tasks').select('*').eq('id', entityId).maybeSingle();
      if (!task) return reply({ error: 'Task unavailable' }, 403);
      const { data: allowed } = await admin.rpc('can_contribute_project', { _project_id: task.project_id, _user_id: actor });
      const { data: assignment } = await admin.from('task_assignees').select('created_at').eq('task_id', task.id).eq('user_id', body.recipientId).maybeSingle();
      const { data: recipientAllowed } = await admin.rpc('can_contribute_project', { _project_id: task.project_id, _user_id: body.recipientId });
      if (!allowed || !assignment || !recipientAllowed) return reply({ error: 'Task assignment access denied' }, 403);
      const { data: project } = await admin.from('projects').select('name').eq('id', task.project_id).single();
      const { data: ws } = await admin.from('workspaces').select('name').eq('id', task.workspace_id).single();
      workspaceId = task.workspace_id;
      recipient = await emailFor(body.recipientId);
      eventKey = `assignment:${task.id}:${body.recipientId}:${assignment.created_at}`;
      data = { assigneeName: await nameFor(body.recipientId), assignerName: await nameFor(actor), workspaceName: ws?.name, projectName: project?.name, taskTitle: task.title, taskDescription: task.description?.slice(0,240), dueDate: task.due_date, taskUrl: projectUrl(task.project_id, task.id) };
    } else if (templateName === 'deliverable-approved' || templateName === 'deliverable-rejected') {
      const { data: review } = await admin.from('deliverable_reviews').select('*').eq('id', entityId).maybeSingle();
      if (!review || review.reviewer_id !== actor || review.decision !== (templateName === 'deliverable-approved' ? 'approved' : 'rejected')) return reply({ error: 'Review access denied' }, 403);
      const { data: project } = await admin.from('projects').select('name,owner_id').eq('id', review.project_id).single();
      const { data: deliverable } = await admin.from('deliverables').select('title').eq('id', review.deliverable_id).single();
      if (!project?.owner_id) return reply({ error: 'Recipient unavailable' }, 400);
      workspaceId = review.workspace_id;
      recipient = await emailFor(project.owner_id);
      eventKey = `review:${review.id}`;
      data = { recipientName: await nameFor(project.owner_id), reviewerName: await nameFor(actor), deliverableTitle: deliverable?.title, projectName: project.name, feedback: review.note, url: projectUrl(review.project_id) };
    } else {
      const { data: notification } = await admin.from('notifications').select('*').eq('id', entityId).eq('user_id', actor).maybeSingle();
      if (!notification?.workspace_id) return reply({ error: 'Notification access denied' }, 403);
      workspaceId = notification.workspace_id;
      recipient = await emailFor(actor);
      eventKey = `notification:${notification.id}`;
      const path = notification.url?.startsWith('/') && !notification.url.startsWith('//') ? notification.url : '/';
      data = { recipientName: await nameFor(actor), title: notification.title, message: notification.body, url: buildAppUrl(path) };
    }
    // Caller-provided recipient, HTML, URLs and idempotency keys are ignored.
    if (!recipient || recipient.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)) return reply({ error: 'Recipient unavailable' }, 400);
    const password = Deno.env.get('SMTP_PASSWORD');
    const user = Deno.env.get('SMTP_USER');
    if (body.dryRun === true) return reply({ success: true, configured: Boolean(password && user) });
    if (!password || !user) return reply({ error: 'Hostinger email is not configured yet' }, 503);
    const { data: suppression, error: suppressionError } = await admin.from('suppressed_emails').select('id').eq('email', recipient.toLowerCase()).maybeSingle();
    if (suppressionError) return reply({ error: 'Email preferences unavailable' }, 503);
    if (suppression) return reply({ error: 'Recipient has opted out of app emails' }, 409);
    const { data: claim, error: claimError } = await admin.rpc('claim_smtp_delivery', { _event_key: eventKey, _workspace_id: workspaceId, _actor_id: actor, _recipient: recipient, _template: templateName });
    if (claimError) return reply({ error: 'Delivery tracking unavailable' }, 503);
    if (claim.state === 'sent') return reply({ success: true, alreadySent: true });
    if (claim.state !== 'claimed') return reply({ error: claim.state === 'limited' ? 'Email limit reached. Try later.' : 'Delivery is already in progress or needs review.' }, 429);
    deliveryId = claim.id;
    const template = TEMPLATES[templateName];
    const html = await renderAsync(React.createElement(template.component, data));
    const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject;
    const transport = nodemailer.createTransport({ host: Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com', port: 465, secure: true, auth: { user, pass: password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 25000, disableFileAccess: true, disableUrlAccess: true });
    smtpAttempted = true;
    try {
      const result = await transport.sendMail({ from: { name: 'Ordo · Inspirare Studio', address: user }, to: recipient, subject: subject.replace(/[\r\n]/g,' '), html });
      if (!result.accepted?.length) throw new Error('SMTP did not accept the recipient');
    } finally { transport.close(); }
    const { error: trackingError } = await admin.from('smtp_deliveries').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', deliveryId);
    if (trackingError) return reply({ error: 'SMTP accepted the message, but tracking needs review. Do not resend.' }, 503);
    return reply({ success: true });
  } catch {
    if (deliveryId) await admin.from('smtp_deliveries').update({ status: smtpAttempted ? 'uncertain' : 'failed', updated_at: new Date().toISOString() }).eq('id', deliveryId);
    return reply({ error: smtpAttempted ? 'Email delivery could not be confirmed. Check delivery before retrying.' : 'Could not prepare email.' }, 503);
  }
});
