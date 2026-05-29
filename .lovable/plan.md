# Fix: Existing-workspace users wrongly sent to onboarding

## Root cause
`useWorkspace` loads workspaces by calling the `list-workspaces` edge function. The function reads the `Authorization` header and calls `admin.auth.getUser(token)`. The edge logs show this failing repeatedly with `AuthSessionMissingError: Auth session missing!`.

Why it fails:
- `load()` fires on `user?.id` change, but `supabase.functions.invoke(...)` does not reliably carry a **valid user access token**. When the auth session is still being restored (or when the functions client falls back to the publishable/anon key as `Authorization`), the token the function receives is not a user JWT, so `getUser(token)` rejects.
- On any error, `useWorkspace` sets `workspaces = []` and `loading = false`.
- `AppLayout` then hits `if (workspaces.length === 0) return <Navigate to="/onboarding" />`, so an owner of 2 workspaces (confirmed in the DB) is pushed into onboarding.

This is an auth-loading / token race condition, not missing membership data.

## Current routing logic
```text
Login -> AppLayout
  authLoading            -> spinner
  !user                  -> /auth
  wsLoading              -> spinner
  workspaces.length === 0 -> /onboarding   <-- fires for owners when list-workspaces errors
  role === "client"      -> /client
  else                   -> dashboard
```
`useWorkspace.load()` runs on `user?.id` change, invokes `list-workspaces` with no explicit token, and empties `workspaces` on error.

## Updated routing logic
1. Only query workspaces once auth is actually ready and a session exists.
2. Always attach the real user access token to the edge function call.
3. Distinguish "still loading / errored" from "confirmed zero workspaces" so we never redirect to onboarding on an error.

```text
authLoading || wsLoading || wsError(unresolved) -> spinner (do NOT redirect)
!user                                            -> /auth
confirmed 0 workspaces (clean success)           -> /onboarding
role === "client"                                -> /client
else                                             -> dashboard
```

## Applied fix

### 1. `src/hooks/useWorkspace.tsx`
- Pull `session` from `useAuth()`.
- Gate `load()` so it runs only when `session?.access_token` exists; otherwise keep `loading = true` (don't flip to an empty, "ready" state).
- Pass the token explicitly to the function:
  ```ts
  supabase.functions.invoke("list-workspaces", {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  ```
- On error, set `error` but keep `workspaces` untouched and treat the state as not-resolved (so `AppLayout` shows a spinner / retry, never onboarding).
- Re-run `load()` when `session?.access_token` changes (not just `user?.id`).

### 2. `src/components/AppLayout.tsx`
- Only redirect to `/onboarding` when workspace loading finished **without error** and the list is genuinely empty.
- While `wsLoading` or an unresolved `error` is present, render the loader (optionally with a retry) instead of redirecting.

### 3. Logging (temporary, console)
Add structured `console.info`/`console.error` logs to make the decision traceable:
- In `useWorkspace.load()`: log `auth user id`, whether a token was attached, the raw `list-workspaces` result (workspaces + error).
- In `AppLayout`: log `user`, `role`, `workspaces.length`, the computed onboarding decision, and the chosen redirect destination.
- In the `list-workspaces` edge function: log the resolved `userId`, owned count, membership count, and final returned count (helps confirm server-side recognition of owners/members).

### 4. Verify
- Reload `/` as the existing owner (who has 2 workspaces) and confirm: token attached, `list-workspaces` returns 2, decision = dashboard (no onboarding).
- Confirm a brand-new account with no workspace still reaches onboarding.
- Confirm a member-only (non-owner) account routes to the app, not onboarding.
- Confirm `list-workspaces` edge logs no longer show `AuthSessionMissingError`.

## Notes
- `list-workspaces` already merges **owned** workspaces and **membership** rows, so owner recognition is correct server-side once a valid token arrives — the bug is the missing/invalid token, addressed in step 1.
- There is no `onboarding_completed` flag in the schema; onboarding entry is driven purely by workspace existence, so no flag handling is needed.
- Logs are temporary and can be removed once verified.
