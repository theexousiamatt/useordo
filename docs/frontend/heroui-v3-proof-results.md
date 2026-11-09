# HeroUI v3 proof results and handoff

Completed 9 November 2026. **Recommendation: conditional adoption; broad migration remains unapproved.**

## Decision

HeroUI v3 is a suitable candidate for Ordo's reusable control foundation, provided the reviewed platform upgrade and complete overlay-family migration pass their gates. It is not compatible with the current React 18 / Tailwind 3 installation as a drop-in dependency. The proof uses React 19.3.1, Tailwind 4.3.4, matching HeroUI React/styles 3.2.7, and Vite 5.4.19 through normal dependency resolution. No forced peers or additional animation framework.

[Compatibility audit](heroui-v3-compatibility.md), [design system and tokens](ordo-design-system.md), [agent/API guide](heroui-v3-agent-guide.md), [revised Phase 2 plan](../phase-2-production-workspace.md).

## Deliverable boundary

- Worktree: `../ordo-heroui-v3-proof`, branch `codex/heroui-v3-proof`.
- Baseline checkpoint: `c2be71e9a739c0bae98fa182100d53aefab92420`, capturing the existing dirty application including Phase 1 work.
- Working proof: `experiments/heroui-v3`, independently locked package and dependencies. Run `npm run dev` there; preview at http://127.0.0.1:5190/.
- Synthetic in-memory tasks only. Reload resets state. No Supabase client, credentials, production requests, schema changes, or persistence claims.
- Includes Board/List, task creation/edit drawer, priority and multiple assignees, native date-only field, column naming dialog, task menu, dnd-kit, theme and reduced-motion controls, pending/error/retry state.
- Original checkout: all 358 checkpoint files compared. Only the two implementation-plan documents changed; source code, dependencies, environment/configuration and original Git index match the checkpoint. New audit/evidence documents are additive.

## Verification

| Check | Result |
|---|---|
| Final proof component tests | 8 passed: task IDs shared across views; pending button semantics; accessible field associations; failed draft/retry without duplicate; required title; root themes; reduced-motion root setting; rename preserves task ID. |
| TypeScript, focused lint, production build | Passed. Final rerun after mobile sizing fix. |
| Browser task form | Existing task populated; priority and member keyboard selection; save pending/success; dirty Escape guard; close returns focus to task trigger. |
| Nested all-HeroUI selector/drawer | Escape closes selector and preserves drawer; trigger focus returns. |
| Retained Radix dialog + HeroUI selector | **Failed coexistence gate:** Escape can dismiss both parent and selector; focus return unreliable. Keep diagnostic sample, do not adopt mixed modal families. |
| dnd-kit | Keyboard reorder observed with stable task IDs. Pointer/touch drag not qualified in this proof. |
| Responsive | Light board at 390px has document width 390px, no horizontal page overflow. Drawer now fills 390px with inline header/close button and visible footer. Desktop checked at 1280px. |
| Themes and motion | Light and experimental dark screenshots inspected. Explicit reduced-motion control applies at document root; computed button transition 0.00001s. System preference CSS implemented but not independently browser-emulated. |
| Existing app checks | Earlier verification in this audit passed: 117 frontend tests, 17 foundation safety tests, canonical SQL suites against two fresh local DBs, typecheck, foundation lint, both app builds. No application changes since that run. |

Visual evidence: [light desktop](../evidence/heroui-v3/proof-light-desktop.png), [light mobile](../evidence/heroui-v3/proof-light-mobile.png), [mobile drawer](../evidence/heroui-v3/proof-mobile-drawer.png), [experimental dark](../evidence/heroui-v3/proof-dark-desktop.png). Existing foundation desktop/mobile baseline captures are retained in the same folder. These are bounded manual visual checks, **not** an automated before/after pixel-diff suite or whole-app React 19 regression certification. Final proof review was self-reviewed; no independent finish review completed.

## Findings incorporated

1. Use complete, namespaced `--ordo-color-*` tokens with an explicit HeroUI adapter; keep legacy HSL channels separate. Preserve Ordo logo, type, spacing and task surfaces.
2. Proposed light accessibility corrections in the proof: muted text lightness 47→42, danger 51→43, warning 44→34, stronger form boundaries. These are specific reviewable proposals, not changes to the shipped palette. Dark remains provisional.
3. Pending spinner is decorative; retain stable button name, native form submission, disabled semantics and a feature-level saving announcement. Do not assume HeroUI supplies `aria-busy` on every pending button.
4. A local CSS motion variant adapter avoids empty selector warnings from the pinned HeroUI/Tailwind combination. It retains system reduced-motion handling plus an Ordo-owned explicit root override. No vendor files patched; reassess on upgrades.
5. Keep draft content through drawer exit animation. Explicitly size the actual drawer dialog and header: outer content width alone leaves HeroUI's default inner panel narrow on mobile.
6. Preserve dnd-kit transform ownership; collision detection must prefer task targets over parent columns, with a separate empty-column path.
7. Evaluation build emits a >500kB chunk warning: JS about 620kB (193kB gzip), CSS about 408kB (42kB gzip). Full styles and two overlay families are present. Measure route splitting/style scope on the real adoption slice; do not infer an app bundle delta from this standalone demo.

## Next approval gate and acceptance criteria

Approve **Phase 2.0: platform and design-system foundation only**, estimated 5–10 engineer-days for the first adoption-ready slice, not all Phase 2:

1. Upgrade React/types and Tailwind/build integration in isolation; resolve next-themes, day-picker, vaul and tailwind-merge peers without forced installs.
2. Establish Ordo semantic tokens, portal theme inheritance, thin shared controls and official-v3 API rules.
3. Migrate one complete form/overlay family as the real app pilot; retain Ordo shell/cards and dnd-kit. Do not nest HeroUI selectors in retained Radix modals.
4. Pass existing app/foundation checks plus real Auth→project journeys, date/drawer regressions, error recovery, keyboard/focus, pointer/touch drag, supported-width/theme visual comparisons and production bundle review.
5. Preserve Phase 1 behavior and confirm no production changes. Only after review and passing gates begin canonical board/task production work under Phase 2.1 onward.

Acceptance: clean peer graph; no broken existing workflows; consistent light/portal colors; reviewed dark scope; named/labelled controls; nested Escape/focus behavior; reduced motion; no console/CSS build errors; documented reversible commits. A standalone green test suite is insufficient to merge the platform upgrade.

## Rollback / resume

The original `ordo` checkout is the rollback path and remains on its existing runtime. Stop the proof's local dev process if no longer needed. No database rollback is necessary. Do not reset, stash or clean the source checkout. The proof branch starts at the named checkpoint; its evaluation changes are confined to `experiments/heroui-v3` and documentation/evidence. For an eventual approved adoption, separate platform, token and feature-family commits and revert those deliberate changes together with their lockfile.

Resume from this document. Do not repeat the repository audit. Next action requires review of Phase 2.0; no broad migration or production board implementation has begun.

Repository handoff: proof changes were staged on `codex/heroui-v3-proof`; the final local commit could not be created because Git author identity is not configured. No global identity was changed, and no push occurred. The baseline checkpoint and original checkout remain available.
