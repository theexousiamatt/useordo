# Fix: Onboarding "Continue" loads forever

## What's happening
- The preview's dev server dropped its connection (`[vite] server connection lost`) right after the last DB migration, so the in-flight `Continue` action never completes and the spinner never clears.
- `createWorkspace` in `src/pages/Onboarding.tsx` only clears the `busy` flag on a couple of explicit error branches. There is no `try/catch/finally`, so any stall or unexpected error leaves the button spinning permanently with no feedback.
- The follow-up failure was a real RLS denial on `workspaces`: the request carried a valid logged-in token and matching `owner_id`, but the database API evaluated the policy as if `auth.uid()` was unavailable. Workspace onboarding now goes through authenticated backend functions that validate the user token server-side before creating or listing workspaces.

## Changes

### 1. Restart the dev server
Recover the wedged preview so the connection-lost state is cleared.

### 2. Harden `createWorkspace` (src/pages/Onboarding.tsx)
- Wrap the whole flow in `try / catch / finally` and always reset `busy` in `finally`, so the button can never spin forever.
- Surface a clear `toast.error` on any unexpected failure instead of silently hanging.
- Treat the non-critical steps (`profiles` update, `activity_logs` insert) as best-effort: their failures should not block creation/navigation (they already aren't return-checked, but make that explicit and logged rather than awaited blocking).
- Add a `console.error` on failures so future issues show up in logs.

### 3. Verify
- Confirm onboarding completes end-to-end for the current authenticated account: workspace row is created, owner membership row is added, and the user lands on the dashboard.
- Confirm `busy` always resets even when an error is forced.

### 4. Route workspace onboarding through backend functions
- `create-workspace` validates the current user token, creates the workspace with that user as owner, creates the owner membership row, and logs the activity.
- `list-workspaces` validates the current user token and returns only workspaces the user owns or belongs to, so the dashboard can load after onboarding.

## Notes / technical detail
- The existing RLS model remains the intended authorization model. The backend functions are a controlled workaround for the current database API token/RLS evaluation mismatch while still enforcing user ownership server-side.
