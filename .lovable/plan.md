## Client OS Dashboard

A Midnight Indigo–themed client portal where users sign in to track their projects, approve tasks, follow updates, and access deliverables. Built on Lovable Cloud with email/password + Google sign-in.

### Design direction

- **Palette**: Midnight Indigo — deep navy background `#0a0a1a`, surface `#141432`, elevated `#1e1e5a`, electric indigo accent `#4f46e5`. Soft white text, muted slate for secondary.
- **Typography**: Inter for UI, slightly tighter tracking on headings.
- **Feel**: Sophisticated SaaS — generous spacing, subtle borders, soft glows on the indigo accent, smooth hover transitions, rounded-xl cards.
- **Layout**: Persistent left sidebar (collapsible to icons) + top header with search/user menu + main content area.

### App structure

```text
┌──────────┬─────────────────────────────────────┐
│          │  Header: search · notifications · me│
│ Sidebar  ├─────────────────────────────────────┤
│ • Overview                                     │
│ • Projects   │  Page content                   │
│ • Approvals  │                                 │
│ • Activity   │                                 │
│ • Files      │                                 │
│ • Settings   │                                 │
└──────────┴─────────────────────────────────────┘
```

### Pages

1. **Auth** (`/auth`) — Email/password + Google sign-in, sign-up tab. Public route.
2. **Overview** (`/`) — KPI cards (active projects, pending approvals, overdue, recent files), progress summary across all projects, recent activity preview.
3. **Projects** (`/projects`) — Card grid of all projects with progress bars, status pill (On Track / At Risk / Blocked / Done), owner avatars, next milestone.
4. **Project detail** (`/projects/:id`) — Tabs: Overview (description, milestones, progress), Tasks (with approve/request changes), Files, Activity.
5. **Approvals** (`/approvals`) — Inbox of all tasks/deliverables awaiting client decision across projects. Inline Approve / Request changes (with note) actions. Filter by project + status.
6. **Activity** (`/activity`) — Chronological feed of updates: status changes, new files, comments, approvals, milestones reached. Filterable by project and type.
7. **Files** (`/files`) — All deliverables across projects with preview/download, grouped by project, searchable, type filter.

### Data model (Lovable Cloud)

- `profiles` — id (→auth.users), full_name, avatar_url, company. Auto-created on signup.
- `user_roles` — separate table with `app_role` enum (`admin`, `client`); `has_role()` security-definer function for RLS.
- `projects` — id, name, description, status, progress (0–100), start_date, due_date, owner_id, client_id.
- `project_members` — project_id, user_id, role (links clients/team to projects).
- `milestones` — project_id, title, due_date, completed.
- `tasks` — project_id, title, description, status (`pending`, `awaiting_approval`, `approved`, `changes_requested`, `done`), assignee_id, due_date.
- `approvals` — task_id, client_id, decision, note, decided_at.
- `files` — project_id, name, storage_path, size, mime_type, uploaded_by, uploaded_at. Stored in a `project-files` bucket (private, RLS-gated).
- `activity` — project_id, actor_id, type, payload (jsonb), created_at. Written by triggers on tasks/files/approvals/milestones.

RLS: clients see only projects where they are a member; admins see all. Approvals writable only by client members of the project. Files readable by project members; signed URLs for downloads.

### Key interactions

- Approve / Request changes from Approvals inbox or task row → writes to `approvals`, flips task status, appends to `activity`, toast confirmation.
- Sidebar collapses to icon rail; trigger always visible in header.
- Real-time-feel updates via React Query refetch after mutations (no realtime channels in v1).
- Empty states everywhere with friendly illustrations and a hint of next action.
- Seed script adds 3 demo projects with milestones, tasks, files, and activity so a new account is immediately useful.

### Out of scope for v1

Comments threads on tasks, in-app messaging, billing/invoices, notification emails, mobile app, custom branding per client. Easy to add later.

### Technical notes

- React + Vite + Tailwind + shadcn/ui; React Router for pages; TanStack Query for data.
- Lovable Cloud for auth, Postgres, Storage. Roles in dedicated `user_roles` table with `has_role()` SECURITY DEFINER function (no role-on-profile).
- Activity feed driven by Postgres triggers writing to `activity` so writes from any path produce a consistent log.
- Files served via signed URLs from a private storage bucket.
