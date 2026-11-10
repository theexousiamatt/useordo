# Phase 2.0 implementation and verification

10 November 2026. **Implemented and self-verified in isolation; pending review, not merged or deployed.** Phase 2.1 has not begun. Physical touch-device and cross-browser qualification remain explicit release gates.

## What changed

- React/DOM 19.3.1, matching types 19.3.0, Tailwind/Vite integration 4.3.4, HeroUI React/styles 3.2.7. Vite stays on its existing major. next-themes 0.4.6, vaul 1.1.2, DayPicker 9.14.0 and tailwind-merge 3.7.0 resolve React/Tailwind compatibility. Normal install followed by `npm ci --strict-peer-deps`; `npm ls --all` exits successfully. No force, legacy-peer-deps or dependency overrides.
- The eleven overlapping legacy custom properties were mechanically namespaced to `--legacy-*`, preserving their values and consumers. Tailwind utility scale compatibility and DayPicker slot/navigation changes preserve established controls without migrating their feature families.
- `src/design-system/styles.css` owns the reviewed full-color Ordo semantic tokens, typography, spacing, radii, motion and explicit HeroUI adapter. Only needed HeroUI component styles are imported; one Tailwind reset remains. Portal content receives `.ordo-ui` itself. The integration is intentionally light-only; existing historical dark routes are retained, not certified or redesigned.
- Thin reusable `OrdoButton`, `OrdoTextField`, `OrdoSelectField` contracts in `src/design-system/controls.tsx`. No backend state, permission inference or task mutations in the component layer.
- One complete real integration: foundation project creation in a HeroUI drawer, including client/initiative selection and inline creation, lifecycle, fields, submission and recovery controls. Radios, discipline checkboxes and the date-only input retain native browser behavior. No HeroUI selector is nested in a retained Radix modal.
- Feature controllers still own dirty/pending dismissal guards, drafts, command IDs, account/tenant query keys and canonical API calls. Shared request/query helpers were extracted without changing their contracts.
- New project setup is lazy-loaded. Existing legacy page routes and workspace provider are also deferred to reduce startup loading, preserving route URLs and behavior.
- dnd-kit remains authoritative for dragging. The existing 8px pointer threshold is shared with tests; a narrowly scoped keyboard fallback now permits movement into empty columns, which the default sortable getter ignored.

## What remains unchanged

Database schema/migrations, authorization commands, RLS/storage policies, authentication implementation, backend API, tenant boundaries, task IDs/persistence model, deadline filtering, studio creation, project overview, existing shell/branding and custom task composition. Existing legacy component families remain in place; new pilot controls have one documented owner rather than being dropped into incompatible overlays. No broad UI replacement, canonical board production features, production changes, push or deployment.

The original checkout remains the rollback path. Its Git index still matches the saved pre-proof hash. Development-only service binaries were repaired after the temporary native cache was found incomplete; existing guarded local bootstrap/seed scripts were used to restore synthetic fixtures. No production service was contacted or reset.

## Automated verification

| Check | Result |
|---|---|
| `npm ci --strict-peer-deps --no-audit --no-fund` | Passed; final complete dependency graph has no invalid peer entries. Initial npm reconciliation warnings were followed by this clean install. |
| `npm test` | **122 passed**, including all existing 117 outcomes adapted for the new form contract, two draft/pending integration cases, and three pointer/keyboard sensor cases. |
| `npm run typecheck` | Passed. |
| `npm run lint:foundation` and focused ESLint on new controls/sensors | Passed. This is focused lint, not a claim that historical whole-repo lint debt has been removed. |
| `npm run build` / `npm run build:foundation` | Both passed; existing large-chunk warning remains, recorded below. |
| `npm run test:foundation:safety` | 17 passed. |
| `npm run verify:foundation:local` | Four canonical SQL suites passed twice in fresh isolated DB instances, including tenant/role/transaction/task-integrity contracts. |
| `npm run verify:foundation:runtime` | Nine real local Auth/RLS/Storage groups passed using the unchanged guarded runtime harness, including private bytes/signed URLs, revocation and fresh sign-in persistence. |
| `git diff --check` | Passed. |

Tests exercise failed draft/retry with the same command ID, exactly one saved task/project outcome, pending duplicate prevention, dirty discard, native date type/values, account-scoped navigation and client denial. Modal tests now assert the accessible foreground instead of interacting with the intentionally hidden background. One retained drawer test waits for mutation settlement before trying dismissal under React 19 scheduling.

## Browser and accessibility checks

Real local owner sign-in, project listing, client project creation linked to Devine Apartments, internal project creation without a fake client, saved overview and reload passed. A native-calendar deadline was selected through its accessible date control and persisted as **10 November 2026** after reload. The browser automation's generic `fill` did not populate native date segments reliably; the final verified journey used the native accessible control. The implementation keeps an explicitly controlled native date input to avoid text-field composition ambiguity.

Nested HeroUI selector Escape preserves the drawer and restores trigger focus. Dirty close retains the draft and offers Keep editing / Discard draft. Pending submission and failed retry are additionally covered by automated integration tests. Fields have associated labels, errors/hints use the HeroUI field contract, saving has a live status announcement, and pending spinners do not alter the button's accessible name. System reduced-motion CSS remains in both retained and new scopes. These are bounded keyboard/semantics checks, not a screen-reader or full WCAG certification.

Pointer dragging and keyboard movement between occupied columns were observed in the retained Kanban fixture. Keyboard movement into an empty Backlog column was then corrected and observed working. The same fixture saves moves in tab-local state; it is **not** evidence that Phase 2 canonical boards have been implemented. Real dnd-kit PointerSensor mouse and touch events pass threshold/move/end tests; **physical-device touch scrolling/dragging was not exercised**.

## Visual evidence and decisions

Evidence is in [phase-2-0](../evidence/phase-2-0): paired retained-board screenshots at 1280×900 and 390×844, old inline form and new drawer at both widths, and the saved internal project.

- [Desktop pilot](../evidence/phase-2-0/project-form-after-desktop.png)
- [Mobile pilot](../evidence/phase-2-0/project-form-after-mobile.png)
- [Saved internal project/deadline](../evidence/phase-2-0/saved-internal-project.png)
- [Retained board before](../evidence/phase-2-0/board-before-desktop.png) / [after](../evidence/phase-2-0/board-after-desktop.png)

A zero-tolerance comparison of normalized screenshot pixels reports **2.8347% desktop** and **3.7870% mobile** changed pixels on the retained board. This is not a zero-diff result: Tailwind 4 now renders the already-declared `--board-card-shadow` arbitrary utility where the old build computed `box-shadow: none`. Inspection confirmed the same card width (272px in the measured desktop view), radius (14px), border RGB(223,226,231), typography/layout and content. This subtle shadow rendering is a visible compatibility difference for review, not a silent claim of perfect visual parity. Browser screenshots were returned as JPEG bytes despite their `.png` filenames; comparisons used macOS `sips` normalization to real PNG followed by the repository's dependency-free comparison script.

Intentional pilot changes: inline creation becomes a focus-managed drawer, stronger field boundaries and reviewed muted/danger contrast roles, consistent focus rings, visible pending states, and guarded draft discard. Latest source also aligns icon/label spans horizontally and uses the installed `.textarea` slot spelling; earlier captures may precede these final small corrections. No whole-app raw-value sweep or new generic style checker was introduced; scope is the approved pilot. Retained families are exempt from migration/fan-out at this checkpoint.

## Bundle impact

Exact built artifacts, raw/gzip sizes and the original baseline are saved in [bundle-sizes.json](../evidence/phase-2-0/bundle-sizes.json).

| Foundation artifact | Before | After |
|---|---:|---:|
| Main JS chunk | 1,087,608 bytes | 752,720 bytes |
| Main JS gzip (same local gzip method) | 312,073 bytes | 220,506 bytes |
| Deferred project-creation JS | none separately | 267,317 bytes / 85,012 gzip |

Main-chunk raw JS drops about 31%; this is **not** a claim that the total application dependency footprint shrank. HeroUI/React Aria add deferred code and selected styles. The build retains a >500kB warning on the main chunk. Initial CSS grew from about 94kB to about 119kB raw; selected pilot styles are separately emitted. Route deferral keeps the pilot out of initial auth/project-list loading. Radix is retained for unmigrated families, not duplicated inside the pilot overlay. Further vendor splitting and supported-browser performance measurement are separate review items; no arbitrary warning threshold was raised.

## Checkpoints and rollback

Branch `codex/heroui-v3-proof`, sibling worktree `ordo-heroui-v3-proof`.

- `c05c248`: reviewed proof checkpoint.
- `41c3ff9`: platform compatibility and legacy token isolation.
- Subsequent integration checkpoint: current branch tip after this report is committed.

Confirmed repository-local author: **Matt <matt@inspirarestudio.com>**. No global Git configuration changed. No merge has been performed. Review commits against `c05c248`; return to the original `ordo` checkout for immediate rollback. Do not reset/stash/clean that checkout. Reverting the platform later must include its package lock, compiler configuration and legacy variable consumers together.

## Review boundary

Approve or revise the pilot visuals and recorded shadow difference before fan-out. Dark mode, physical touch devices, screen-reader checks and additional supported browser engines remain unqualified. Phase 2.0 is code-complete and self-verified within these stated limits; it is not an unrestricted release certification. No Phase 2.1 or wider component migration starts without review.
