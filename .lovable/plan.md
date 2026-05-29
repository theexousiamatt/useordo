## Problem

The "Ordo Client OS" reference design was built only as a separate set of pages under the **`/client`** route. The main authenticated app at **`/`** still renders the original shell (`AppSidebar` + `AppHeader` + plain stat-card `Dashboard`). On top of that, all of the reference's design tokens (rounded panels, soft shadows, badge colors, surfaces) live scoped inside a `.client-os` CSS wrapper, so none of that styling reaches the main app. That's why, viewing `/`, you see the old UI and conclude the reference "isn't applied".

You chose to apply the reference design to **both `/` and `/client`**, so the plan brings the Ordo Client OS visual language into the main internal app.

## What gets built

### 1. Promote the design tokens
- Lift the `.client-os` token block in `src/index.css` so the Ordo Client OS surfaces, radii, shadows, and badge colors apply to the whole authenticated app (keep `.client-os` as an alias so existing `/client` pages keep working).

### 2. New main-app shell (matches the reference)
- Restyle `AppLayout` to use the Ordo panel layout: padded canvas, rounded sticky sidebar, content column with header — same structure as `ClientLayout`.
- Create an internal sidebar in the Ordo style (reusing the `ClientSidebar` look: traffic-light dots, Ordo logo, pill nav, active state, badges) but pointing at the internal nav: Dashboard `/`, Projects, Tasks, Clients, Team, Activity, Settings.
- Restyle the header to the Ordo `ClientHeader` pattern (title/subtitle + search + notifications + profile menu), reusing `WorkspaceSearch`, `NotificationButton`, and `UserProfileMenu` where they fit.
- Keep the mobile nav, restyled to match.

### 3. Redesign the main Dashboard (`/`)
- Rebuild `src/pages/Dashboard.tsx` using the reference card components: `ProjectOverviewCard`, `ActionCenter`, `ActivityFeed`, `MilestoneTimeline`, with the same section hierarchy and spacing as `ClientDashboard`, wired to the workspace's real data (projects/tasks/activity) with the existing loading / empty / error states.

### 4. Align the other internal pages
- Apply the Ordo card / panel styling and `ClientHeader`-style page headers to Projects, Tasks, Clients, Team, Activity, and Settings so they match the reference (no logic changes — presentation only).

### 5. `/client` stays intact
- The existing `/client` routes keep working with the same design (now sharing the promoted tokens).

## Verification
- Load `/` as a workspace owner and confirm the Ordo Client OS shell, sidebar, header, and redesigned dashboard render (no old layout).
- Click through Projects/Tasks/Clients/Team/Activity/Settings to confirm consistent styling.
- Confirm `/client` still renders correctly.
- Check the preview at the current mobile-ish viewport (738px) for responsive behavior.

## Technical notes
- This is presentation/layout work; routing and data hooks (`useWorkspace`, `useClientDashboard`, page data hooks) are reused unchanged. The recent onboarding/redirect fixes in `AppLayout`'s routing logic are preserved — only the rendered shell markup changes.
