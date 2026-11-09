# HeroUI v3 compatibility audit

Completed before dependency installation, 4 November 2026. Verdict: **conditional go for an isolated React proof; the existing application is not a drop-in compatible stack.** Production and the current application's dependencies remain untouched. Whole-application adoption requires the platform and regression gate below and user review.

## Current application and official requirements

| Area | Current installed setup | HeroUI v3 assessment |
|---|---|---|
| React/DOM | 18.3.1, modern createRoot/JSX transform | Official v3 requires React 19+. Upgrade both together, with matching type packages. |
| Tailwind | 3.4.17; JS config; @tailwind directives; tailwindcss PostCSS plugin and autoprefixer | Official v3 requires Tailwind 4. Use the supported Vite plugin or new PostCSS plugin; review utility/preflight changes. |
| Vite | 5.4.19 + React SWC 3.11 | Not an inherent blocker: @tailwindcss/vite 4.3.4 accepts Vite ^5.2, 6, 7 or 8. Keep unrelated bundler upgrades outside this proof. |
| TypeScript | 5.8.3; bundler module resolution | Suitable for initial evaluation. React 19 types expose existing useRef-without-initializer and global JSX namespace assumptions. |
| Primitive system | 48 shadcn UI TSX modules, Radix, CVA, cn/tailwind-merge 2.6 | 25 modules have direct outside-UI imports; migrate used families deliberately. HeroUI's compound APIs are not drop-in Radix replacements. |
| Forms | Native controlled inputs, React Hook Form 7, Zod 3; duplicated auth/product controls | Preserve validation, refs, submit behavior, controlled string IDs, draft/retry ownership. HeroUI field accessibility can improve label/hint/error associations. |
| Drag/drop | dnd-kit core 6.3.1, sortable 10 | Peer ranges permit React 19; retain it and verify pointer/keyboard transforms, menus and focus. |
| Themes | Dark indigo root; light .client-os overrides; next-themes 0.3 installed | Current next-themes peers exclude React 19. Establish one explicit theme/portal boundary and review compatible version separately. |
| Calendar/sheet extras | react-day-picker 8.10.1, vaul 0.9.9 | Their installed peer ranges exclude React 19. Replace only used controls deliberately or upgrade/adapt; do not install using force/legacy-peer-deps. |
| Animation | CSS, tailwindcss-animate, Radix state classes; inconsistent 150–500ms durations | HeroUI v3 uses CSS animation; no new Framer Motion dependency/provider is needed. Preserve dnd-kit transform ownership and reduced-motion behavior. |
| Tests | Vitest 3.2.4, Testing Library installed 16.3.2, jsdom 20; 117 recorded frontend tests | Testing Library peers accept React 19. Retain current behavior tests; add real browser checks for React Aria layout/overlay interactions. |

Official sources: [v3 quick start](https://heroui.com/docs/react/getting-started/quick-start), [HeroUI package manifest](https://github.com/heroui-inc/heroui/blob/v3/packages/react/package.json), [v3 theming](https://heroui.com/docs/react/getting-started/theming), [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide), [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide), [Tailwind Vite package](https://github.com/tailwindlabs/tailwindcss/blob/main/packages/@tailwindcss-vite/package.json).

Read-only npm registry metadata confirmed matching @heroui/react and @heroui/styles **3.2.7**, React/DOM **19.3.1**, Tailwind/Vite plugin **4.3.4**, and React type packages **19.3.0** before installation. Pin the proof's versions and lockfile. HeroUI also declares React Aria/date peers; use normal peer resolution and inspect the resolved graph rather than inventing peer requirements from the docs site's development toolchain.

## Material conflicts

1. **Color-variable collision.** Ordo's --background, --foreground, --accent, --muted, --border, etc. hold HSL channel triples consumed by hsl(var(...)). HeroUI uses complete color values. A global import can produce invalid colors such as hsl(oklch(...)) and change semantic meaning: HeroUI muted is text, while Ordo muted is a surface. Establish namespaced Ordo full-color tokens and explicit consumer adapters; never overwrite existing variables indiscriminately.
2. **Portals and theme inheritance.** Light styling is scoped beneath .client-os. OrdoDrawer/OrdoMenu repeat that class on portal content, but current select/date/multiselect content does not consistently do so. Root toasters also sit outside light scope. A migration must theme the portal root, not just the trigger. Test a HeroUI selector inside a retained Radix sheet as a specific coexistence stress case.
3. **Event/composition mismatch.** v3 uses onPress, isDisabled/isPending, compound parts and its own controlled overlay API. Current callers use onClick, disabled, asChild, data-state and Radix-specific CSS/focus events. Define behavior contracts; do not silently forward incompatible props or keep timing hacks by habit.
4. **Platform-wide CSS changes.** Tailwind 4 changes resets, ring/shadow/radius utilities, config discovery and CSS compilation. Its browser baseline is Safari 16.4+, Chrome 111+, Firefox 128+. Browser support must be accepted before shipping the full upgrade. tailwind-merge 2 is a Tailwind 3 merger; migrate it with the style-engine upgrade.
5. **React 19 peer/type cleanup.** next-themes, day-picker and vaul require deliberate decisions. Existing no-argument useRef calls and JSX.Element usages need targeted fixes. Avoid a forced install or a global codemod without a reviewed diff.
6. **Overlays and task transformations.** Two modal/focus systems can disagree about outside clicks, Escape and portal ownership. HeroUI pressed-scale styles must not overwrite a draggable task's transform. A demo button alone cannot certify this integration.

## Retain, migrate, replace

| Family | Decision |
|---|---|
| Ordo branding, app shell/sidebar, page layouts, typography hierarchy, project/task card composition | Retain. These are Ordo product design, not library primitives. |
| Phase 1 schema, Auth, organization/capability resolution, query/request IDs, feature controllers | Retain. UI primitives do not own authorization or persistence. |
| Buttons/text/password/textarea fields | Pilot migration to HeroUI behind a small Ordo control contract. Consolidate duplicated auth/product mechanics only after current tests pass. |
| Select/multiselect/member picker, checkbox/radio/switch | Migrate active families in small batches; preserve option rendering, IDs and controlled values. |
| Menus/popovers/tooltips/dialogs/drawers | Migrate a complete interaction family together after nested-overlay/focus/dismissal proof. Preserve dirty/pending close guards in the feature controller. |
| Date fields/calendar | Deliberate later family gate; preserve YYYY-MM-DD, clearing and local-calendar behavior. A library calendar is not a reason to change deadline semantics. |
| State screens/cards/form sections/tables/task surfaces | Retain composition; consume shared tokens and new controls where useful. No wrapper for every HeroUI primitive. |
| dnd-kit and task-ordering/domain logic | Retain. Test React 19 behavior and keep task records authoritative. |
| Toasts | Converge on one service. Product calls currently use Sonner; do not add HeroUI Toast as a third system during the proof. |
| Unused scaffold components | Do not migrate just to reproduce the scaffold. Confirm indirect/dynamic consumers before later removal. |

Thin reusable layer: OrdoButton for stable visual variants/pending behavior; OrdoTextField for label/hint/error/control associations; OrdoMemberPicker for recurring team presentation; OrdoDialog/OrdoDrawer for consistent layout/close guards; OrdoActionMenu when shared action configuration is valuable. Use HeroUI directly for ordinary composition where an Ordo wrapper adds no contract. Keep task mutations, permissions, history, notifications and request IDs outside wrappers.

## Isolated proof and limits

Use a separate codex worktree containing a checkpoint of the **current dirty application**, not HEAD alone: HEAD would omit approved Phase 1/untracked work. Preserve the source checkout/index byte-for-byte. The proof gets its own package/lockfile/node_modules with React 19, Tailwind 4 and HeroUI 3.2.7; it makes no backend calls and uses clearly marked synthetic state.

Pilot: Ordo task surface, task form in a drawer, priority/assignee selectors, a configuration dialog, action menu, pending/error/retry states and light/dark control. Include a retained Radix-sheet/nested-HeroUI-selector stress case. Preserve incumbent Ordo dimensions and colors through an explicit token adapter. Do not mount two Tailwind resets in one document. Baseline current routes remain on their existing package/style engine during this evaluation.

This validates the new component foundation and known coexistence risks. It **does not claim the entire application has been upgraded to React 19/Tailwind 4**. That requires the approved platform gate, peer upgrades, all current automated checks and real foundation journeys. A CSS-only preview is available from HeroUI, but would not satisfy the requested React accessibility/behavior foundation and is not the recommended adoption path.

## Verification gates and effort

Proof gates: normal clean dependency resolution; TypeScript/production build; component behavior tests; browser form submission/validation, nested overlays, Escape/focus return, pending-close guard, error draft/retry, menu action, touch layout, light/dark portal colors, reduced motion, and installed dnd-kit keyboard/pointer behavior where exercised. Save desktop/mobile evidence and a bounded visual comparison against incumbent tokens/states. Mark unexercised cases explicitly.

Before merging platform adoption: current app TypeScript and all 117+ tests; foundation focused lint, safety/SQL checks and both builds; real sign-in→client/internal creation→saved overview; account switching/client denial; deadline/drawer regressions; baseline/after captures of changed routes in supported themes and widths. No broad migration until the proof is reviewed. Existing full-repo lint/dependency findings remain explicit release work.

Estimated engineering effort after review (ranges, not delivery promises): platform/peer compatibility 1–3 days; tokens/theme/portal bridge and thin core controls 2–3 days; one real foundation pilot and regression qualification 2–4 days. Roughly **5–10 engineer-days** for an adoption-ready first slice, with Phase 2 families migrated incrementally as their features are built. A whole-app primitive replacement is separate scope, not assumed in this estimate.

Rollback: during evaluation return to the original checkout; discard/revert only proof commits in the isolated worktree. Do not stash/reset/clean the current app. For a later merged adoption, keep platform, token bridge and feature-family changes in separate commits so their lockfiles/source can be reverted deliberately. Record checkpoint commit, worktree path, source manifest and verification results with the proof.

## Completed proof

See [proof results and handoff](heroui-v3-proof-results.md) for actual verification, the failed mixed-overlay gate, proposed contrast corrections, motion adapter and remaining adoption criteria. The proof is complete; full application adoption awaits review.
