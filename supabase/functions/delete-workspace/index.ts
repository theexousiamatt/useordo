import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userData.user.id

    const body = await req.json().catch(() => ({}))
    const workspaceId = body?.workspaceId
    if (!workspaceId || typeof workspaceId !== 'string') {
      return json({ error: 'workspaceId is required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Only the workspace owner may delete it.
    const { data: ws, error: wsErr } = await admin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .maybeSingle()
    if (wsErr) return json({ error: wsErr.message }, 500)
    if (!ws) return json({ error: 'Workspace not found' }, 404)
    if (ws.owner_id !== userId) return json({ error: 'Only the owner can delete this workspace' }, 403)

    // Collect project ids for project-scoped child tables.
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)
    const projectIds = (projects ?? []).map((p: { id: string }) => p.id)

    // Delete project-scoped tables first (they key off project_id only).
    const projectScoped = ['tasks', 'milestones', 'deliverables', 'files', 'activity', 'project_activity', 'project_members', 'project_comments', 'project_files']
    if (projectIds.length) {
      for (const table of projectScoped) {
        await admin.from(table).delete().in('project_id', projectIds)
      }
    }

    // Delete workspace-scoped tables.
    const workspaceScoped = ['activity_logs', 'ai_plan_items', 'ai_plans', 'approvals', 'workspace_invitations', 'workspace_members', 'projects']
    for (const table of workspaceScoped) {
      await admin.from(table).delete().eq('workspace_id', workspaceId)
    }

    const { error: delErr } = await admin.from('workspaces').delete().eq('id', workspaceId)
    if (delErr) return json({ error: delErr.message }, 500)

    return json({ success: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
