# Ordo design system proposal

Status: **proposal for review**, 4 November 2026. This captures the current Ordo interface and defines a small shared control foundation for the isolated HeroUI v3 proof. It does not approve application-wide migration, change the current app, or certify a dark theme. Review the proof and this proposal before extending the new controls to other feature families.

The shipped light `.client-os` interface is the visual baseline. Preserve its quiet surfaces, deep green actions, readable hierarchy and purposeful task density. The current dark indigo `:root` palette is historical implementation, not an approved dark counterpart to the light product.

Related evidence: [HeroUI v3 compatibility audit](heroui-v3-compatibility.md). The supplied compatibility-audit checkpoint for the proof is `c2be71e9a739c0bae98fa182100d53aefab92420`. The isolated proof is in the sibling `ordo-heroui-v3-proof` workspace; its results must distinguish demonstrated behavior from unexercised cases.

## Sources and scope

Authoritative current values come from [index.css](../../src/index.css), [Tailwind configuration](../../tailwind.config.ts), [auth controls](../../src/components/auth), [Ordo controls](../../src/components/ordo) and their actual callers. CSS values take precedence over approximate hex comments in the source. No rendered measurement or cross-browser certification is implied by this source inventory.

Retain the logo, app shell, page layouts, task-card composition, feature controllers, authorization, query keys, request IDs and persistence contracts. HeroUI supplies control behavior and accessible composition; it does not own Ordo's business rules or layout.

## Token ownership and adapters

Use three explicit layers:

1. **Ordo reference values:** the documented source values below. Preserve the light baseline unless a reviewed accessibility correction requires a specific adjustment.
2. **Ordo semantic tokens:** namespaced, complete CSS values such as `--ordo-color-canvas`, `--ordo-color-surface`, `--ordo-color-text`, `--ordo-color-text-muted`, `--ordo-color-action`, `--ordo-radius-control` and `--ordo-shadow-panel`. Feature composition consumes these stable roles.
3. **Consumer adapters:** map semantic roles to the actual HeroUI token/slot contract verified in the proof. Retained legacy controls receive a separate HSL-channel adapter until they are migrated. Component-library token names do not define Ordo's product semantics.

The existing unprefixed variables contain **HSL channel triples**, for example `--background: 220 16% 95%`, and current Tailwind utilities consume `hsl(var(--background))`. New semantic colors contain a complete color, for example `--ordo-color-canvas: hsl(220 16% 95%)`. Never place a complete color inside an existing channel variable and then wrap it in `hsl()` again.

Illustrative adapter boundaries, not application code to copy indiscriminately:

```css
.ordo-theme {
  --ordo-color-canvas: hsl(220 16% 95%);
  --ordo-color-surface: hsl(0 0% 100%);
  --ordo-color-text: hsl(210 8% 11%);
  --ordo-color-text-muted: hsl(213 6% 47%);
  --ordo-color-action: hsl(178 100% 8%);
}

/* Retained utilities still consume hsl(var(--background)). */
.ordo-legacy {
  --background: 220 16% 95%;
  --foreground: 210 8% 11%;
  --muted: 220 14% 96%;
  --muted-foreground: 213 6% 47%;
}

/* Representative full-color library adapter; confirm all slots in the proof. */
.ordo-heroui {
  --background: var(--ordo-color-canvas);
  --foreground: var(--ordo-color-text);
  --muted: var(--ordo-color-text-muted);
  --accent: var(--ordo-color-action);
}
```

Legacy `muted` is a surface; HeroUI `muted` is text. Legacy `input` is a border color, not an input surface. Audit mappings by their visual role rather than copying identically named variables. Prefer complete named colors or an explicit full-color alpha mix for new styling; retain legacy `/opacity` utilities only where their channel adapter remains valid.

An element cannot provide both representations of the same unprefixed variable at once. Keep retained and migrated control scopes explicit, including portal content. Nested coexistence must pass the retained-sheet/new-selector proof before reuse. Do not install two Tailwind resets into one document. Remove a legacy adapter only after its consumers have been migrated and checked.

## Light palette

The proposed semantic names below preserve the current values. They are not new colors.

| Role / proposed semantic token suffix | Current source token | Exact current value |
|---|---|---|
| `canvas` | `background` | `hsl(220 16% 95%)` |
| `text` | `foreground`, `card-foreground`, `popover-foreground` | `hsl(210 8% 11%)` |
| `surface`, `overlay` | `card`, `popover` | `hsl(0 0% 100%)` |
| `surface-subtle` | `secondary`, `muted` | `hsl(220 14% 96%)` |
| `text-muted` | `muted-foreground` | `hsl(213 6% 47%)` |
| `text-tertiary` | `text-tertiary` | `hsl(218 11% 65%)` |
| `action`, `focus` | `primary`, `accent`, `ring` | `hsl(178 100% 8%)` |
| `on-action` | `primary-foreground`, `accent-foreground` | `hsl(0 0% 100%)` |
| `action-hover` | `primary-hover` | `hsl(178 100% 12%)` |
| `action-pressed` | `primary-active` | `hsl(177 100% 6%)` |
| `action-surface` | `primary-surface` | `hsl(180 30% 96%)` |
| `action-border` | `primary-border` | `hsl(178 26% 84%)` |
| `action-text` | `primary-text` | `hsl(178 90% 12%)` |
| `border`, `field-border` | `border`, `input` | `hsl(0 0% 94%)` |
| `danger` | `destructive` | `hsl(0 72% 51%)` |
| `success` | `success` | `hsl(160 84% 39%)` |
| `warning` | `warning` | `hsl(32 95% 44%)` |
| `on-status` | destructive/success/warning foreground | `hsl(0 0% 100%)` |
| `sidebar` | `sidebar-brand` | `hsl(178 100% 8%)` |
| `sidebar-text` | `sidebar-ink` | `hsl(0 0% 100%)` |
| `ai-surface` | `ai-surface` | `hsl(180 32% 97%)` |
| `ai-border` | `ai-border` | `hsl(178 24% 86%)` |
| `ai-text` | `ai-text` | `hsl(178 80% 16%)` |
| `ai-glow` | `ai-glow` | `hsl(178 100% 8%)` |

The official logo separately uses accent `#13BB7B`, neutral bars `#2C4244` and wordmark ink `#03181B`. Keep the artwork's colors; do not substitute a generic library accent into the logo. Auth submit buttons currently use foreground ink rather than primary green. Preserve that authored distinction through an explicit auth/ink treatment during the proof rather than changing it accidentally.

Board-specific roles remain independent of generic panels:

| Role | Exact current value |
|---|---|
| Canvas | `hsl(220 14% 97%)` |
| Column | `hsl(216 18% 94%)` |
| Task card | `hsl(0 0% 100%)` |
| Border | `hsl(216 15% 89%)` |
| Strong border | `hsl(215 13% 73%)` |
| Green badge surface / text | `hsl(152 76% 90%)` / `hsl(160 94% 30%)` |
| Orange badge surface / text | `hsl(45 93% 89%)` / `hsl(32 95% 44%)` |
| Red badge surface / text | `hsl(0 86% 94%)` / `hsl(0 72% 51%)` |

## Typography and spacing

No custom font file, `@font-face`, font stylesheet or font-family override is present in the current app. Preserve Tailwind's system sans stack: `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`. The actual glyphs vary with operating system; this is not a promise of identical type rendering across devices. A new hosted font would be a separate design decision.

Body feature settings currently request `cv02`, `cv03`, `cv04`, `cv11`; support depends on the resolved system font. Retain 400 for body text, 500 for labels/actions, 600 for most headings and task titles, and 700 only where existing auth display text uses it. Avoid making all controls semibold during migration.

| Use | Current source values |
|---|---|
| Task title | 14px, weight 600, snug line height |
| Product body / field text / actions | Usually 14px; standard actions weight 500 |
| Secondary details / field hints | Usually 12px; auth hints/errors 13px |
| Auth field text | 15px; auth status text 13.5px |
| Small section / drawer headings | 18px or 20px, generally weight 600 |
| Foundation page heading | 30px, weight 600, tracking `-.025em` |
| Existing project page heading | `clamp(1.6rem, 2vw, 2rem)`, weight 600, tracking `-.025em` |
| Auth identity heading | 28px, rising to 32px at `sm`, weight 700, tight leading/tracking |

Use existing 4px-based spacing rather than introducing a new rhythm: 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48 and 64px are the active Tailwind increments. Proposed aliases name their use: control gap 8px; label-to-field gap 8px; compact form section gap 16px; section separation 24px; panel padding 24px; compact task padding 16px. Preserve intentional 14px field insets and 20px mobile panel insets.

## Shapes, elevation and dimensions

| Role | Exact incumbent value / behavior |
|---|---|
| Large panel | Radius 28px |
| Generic card | Radius 20px |
| Standard control / small surface | Radius 12px |
| Pill | Radius 99px |
| Task card / board column | Radius 14px / 18px |
| Legacy generic radius | `--radius: .75rem`; `rounded-lg` 12px, `rounded-md` 10px, `rounded-sm` 8px at the default root size |
| Product input / select trigger | Height 44px; horizontal inset 14px |
| Product textarea | Minimum height 96px; horizontal inset 14px; vertical inset 12px |
| Standard / small / large product button | Height 40px / 36px / 44px |
| Auth input | 14px vertical and 16px horizontal padding; 15px type; height is content-derived |
| Auth primary button | 14px vertical and 24px horizontal padding; pill shape |
| Generic side drawer / task drawer | Full width on narrow screens; desktop max-width 448px / 600px |
| Action menu | Width 240px, maximum height 70vh; scroll overflow |
| Board column | `min(84vw, 320px)` on narrow screens; 300px at `sm` |

Preserve these elevation values without substituting a library shadow scale:

```css
--ordo-shadow-subtle: 0 2px 8px rgba(0, 0, 0, .03);
--ordo-shadow-panel: 0 12px 36px -8px rgba(0, 0, 0, .04),
                     0 4px 16px -4px rgba(0, 0, 0, .02);
--ordo-shadow-hover: 0 16px 40px -8px rgba(0, 0, 0, .06);
--ordo-shadow-task: 0 2px 8px -3px rgba(20, 31, 38, .09);
--ordo-shadow-task-hover: 0 10px 24px -10px rgba(20, 31, 38, .18);
```

Keep surface hierarchy legible through background, spacing and a deliberate border or elevation choice. Do not add a shadow to every field or nested panel because the library offers one. Existing values are evidence; the proof must expose any necessary, specifically reviewed correction.

## Interaction and motion

Current motion is a baseline inventory, not yet a unified motion system:

| Interaction | Current duration / treatment | Proposal |
|---|---|---|
| Task card hover | 150ms border/shadow transition | Preserve. |
| Task inline popover | 165ms ease-out, fade/95% scale | Preserve intended speed; map new state selectors deliberately. |
| Task detail drawer | 200ms open / 150ms close | Use as the proof's drawer baseline. |
| Generic sheet | 500ms open / 300ms close, ease-in-out | Record as legacy. Review convergence with task-drawer timing after side-by-side evidence. |
| Generic dialog | 200ms fade/scale/translation | Preserve observed behavior during the first family migration. |
| Sidebar | 300ms width/margin ease-in-out; label fade 250ms | Retain in app layout; do not move to primitive wrappers. |
| Accordion | 200ms ease-out | Retain only if an actual consumer needs it. |
| Date-calendar expansion | 300ms grid/opacity | Preserve functional disclosure; review keyboard focus while collapsed. |
| Auth invalid field | 400ms linear shake, ±5px | Existing treatment, not a requirement for new forms. Keep error text authoritative; reduced motion removes the shake. |
| Auth action | 1px hover lift | Preserve only on the authored auth treatment. |

Do not layer default library pressed-scale transforms onto dnd-kit task transforms. dnd-kit owns task positioning; control focus/pressed feedback must not alter placement. Menu actions should transition focus after closure through an explicit state contract rather than carrying the existing 130ms delay and 350ms dismissal grace period into the new implementation by default.

Current reduced-motion CSS sets animation/transition duration to `.01ms` and disables smooth scrolling beneath `.client-os`. The new themed root and every portal must receive equivalent reduced-motion behavior. Do not leave the spinner or close transition as the only indication of state; include text/accessible status.

## Control state and accessibility contracts

All supported controls must define default, hover, pressed/selected, focus-visible, disabled, pending, invalid and read-only states where applicable. A missing state is a migration defect even if the static preview matches.

- **Focus:** keyboard focus is visible on every action, field and menu item. The light primary focus color stays the brand green; the current translucent ring is not automatically sufficient. Keep focus within a modal, restore it to a meaningful trigger on close, and allow the intended handoff into an inline editor.
- **Fields:** one label association, stable IDs, `required` semantics, linked descriptions/errors and correct `aria-invalid` state. A required asterisk is decorative to assistive technology. Do not use placeholder text as the only label. Preserve native name/type/autocomplete and password-manager behavior.
- **Pending:** prevent duplicate command submission; expose pending status; retain the entered draft. A wrapper renders pending state, while the feature controller owns the actual request, idempotency key and close guard.
- **Errors:** explain the failed action and recovery. Preserve drafts on request failure. Successful appearance requires confirmed persistence; an empty affected-row result is not success.
- **Read-only:** show actual values and hide unavailable mutations. Do not make readable values look like disabled inputs throughout an overview.
- **Selection:** use controlled values and actual IDs. Radio/checkbox/multiselect states remain keyboard operable and are announced correctly. Menu actions and row activation must not fire together.
- **Overlays:** title/description, initial focus, Escape, outside interaction, nesting, scrolling and focus restoration are explicit contracts. Dirty/pending-close decisions stay with the feature. Portalled children receive the same theme as their trigger.
- **Drag/drop:** retain a visible task handle, keyboard behavior and equivalent move actions. Moving, cancelling and failed persistence are announced. Touch scrolling remains possible outside the handle.
- **Status:** names/text accompany color. Overdue state, validation and priority are not communicated by tint alone. Dynamic success/errors use an appropriate live region without repeatedly announcing every render.

Release targets are at least 4.5:1 for ordinary text, 3:1 for large text and 3:1 for essential control/focus indicators against adjacent colors. Test zoom/reflow, keyboard-only operation, screen-reader labels and touch input in rendered components. This proposal is not an accessibility certification.

### Known light contrast gaps

The following are calculations from the exact current HSL values using sRGB relative luminance; alpha examples composite over white. They are baseline pair checks, not screenshots or a complete state audit. Preserve the recorded source values and introduce a specifically named corrected role where needed; do not silently claim the current palette passes.

| Current pair | Approximate ratio | Consequence |
|---|---:|---|
| Primary on white | 15.62:1 | Strong ordinary-text/action contrast. |
| Muted text on white / canvas | 4.52:1 / 4.02:1 | White is marginal; current canvas pairing misses the ordinary-text target. |
| Tertiary text on white | 2.54:1 | Do not use it for required small copy/placeholders without correction. |
| Subtle border on white | 1.14:1 | Cannot be the sole essential control-boundary indicator. |
| Primary ring at 30% / 10% over white | 1.90:1 / 1.22:1 | Current ring tint alone is below the control-indicator target; verify any additional border/outline. |
| Success text on white | 2.59:1 | Needs a darker semantic text role for normal-size copy. |
| Warning text on white | 3.15:1 | Insufficient for normal-size copy. |
| Destructive text on white | 4.80:1 | Passes this baseline ordinary-text pairing; other states/backgrounds still need checks. |
| Green / orange / red badge text on matching badge surface | 3.38:1 / 2.77:1 / 3.93:1 | Existing small badge copy needs reviewed text-role corrections. |

Focus opacity, placeholder opacity, disabled styling and background tint alter these ratios. Record final rendered pairs and fixes with the proof. Disabled controls are distinct from enabled low-contrast text; do not use a disabled appearance to avoid fixing an active control.

## Experimental dark theme

**Dark mode is experimental and not certified for production.** The old indigo root is not the approved dark design. A dark switch in the proof demonstrates token/portal propagation and interaction states; it does not certify every page or publish a dark-theme promise.

These proposed values are derived from Ordo's green/neutral family and are explicitly new candidates. They do not replace the current light values or describe an existing shipped dark skin:

| Role | Proposed candidate | Qualification |
|---|---|---|
| Canvas | `hsl(180 18% 8%)` | Derived; needs rendered hierarchy and contrast checks. |
| Surface | `hsl(178 14% 11%)` | Derived; verify field/card separation. |
| Raised overlay | `hsl(178 12% 15%)` | Derived; verify nested layers and backdrop. |
| Text | `hsl(180 12% 94%)` | Derived; verify all size/weight combinations. |
| Muted text | `hsl(178 8% 72%)` | Derived; test every surface and opacity. |
| Border | `hsl(178 10% 30%)` | Derived; may need a separate strong control-boundary role. |
| Action / focus | `hsl(160 70% 65%)` | Derived; use deep green foreground, not an assumed white label. |
| On-action | `hsl(178 100% 8%)` | Existing hue/value reused in a new dark-theme role; verify pair. |

Status text/fills, selected surfaces, disabled controls, autofill, native date/select surfaces, charts, images, overlays and shadows have **no qualified dark mapping yet**. A complete dark release requires those roles, all supported routes and widths, rendered contrast/focus evidence, and user review. Do not inherit missing dark values from the light palette or the unrelated indigo root silently.

## Responsive and portal behavior

Preserve current Tailwind breakpoints while evaluating the new control foundation: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px and `2xl` 1536px. The legacy container has its own 1400px `2xl` width. These are layout contracts, not a requirement to wrap every screen in the same maximum-width container.

Forms become one column on narrow screens; optional detail disclosure retains entered values. Drawers use the viewport width on mobile, have a reachable close action, keep primary actions visible, and scroll their body independently where necessary. Menus/selectors constrain width/height to the viewport and handle long names without hiding the selected value entirely. Boards remain horizontally scrollable with independent column scroll behavior; dragging must not prevent ordinary touch scrolling.

Check at least a 390px mobile viewport and a representative desktop width, plus long labels, increased text size/zoom, validation copy and multiple selected members. Verify the new platform's supported browser baseline before adoption, as recorded in the compatibility audit.

Create a themed portal root with explicit light/dark state, foreground/background tokens, font inheritance and reduced-motion scope. Retained Radix and new HeroUI overlays must agree about modality and dismissal in the tested coexistence case. Root-level toasts must use the same theme. Avoid relying on the DOM ancestry of a trigger when its content renders elsewhere.

## Thin wrapper contracts

Wrappers exist only when they preserve an Ordo contract. Do not mirror the entire HeroUI component catalog or turn wrappers into authorization/data layers.

| Wrapper / composition | Stable contract | Remains with the feature controller |
|---|---|---|
| `OrdoButton` | Deliberate visual intent, compact/default sizing, pending/disabled state, accessible icon label, native submit semantics. Auth ink treatment is explicit. | Actual action, request, permission and success/error ownership. |
| Text/password/textarea field family | Controlled value, forwarded control ref, stable label/description/error IDs, required/invalid semantics, native form metadata; password visibility where needed. | Validation policy, persisted draft and server error mapping. |
| `OrdoSelect` | Controlled scalar ID, label/description/error association, option rendering, clear/empty behavior when supported. | Allowed options, permission and saving. |
| `OrdoMemberPicker` | Recurring avatar/name/email presentation, controlled selected IDs, accessible multiple selection. | Authoritative eligible people, scope and assignment transaction. |
| `OrdoDateField` | ISO date-only/null contract, display, clearing and optional presets; no timezone conversion of a deadline. | Date constraints, scheduling rules and save lifecycle. |
| `OrdoDialog` / `OrdoDrawer` | Controlled open request, accessible title/description, agreed layout/scroll/footer, explicit focus handoff and close request. | Dirty/pending guards, confirmation, navigation and persistence. |
| `OrdoActionMenu` | Shared action configuration for context/overflow entry points where valuable; labels/icons/shortcuts, disabled/destructive states and focus handoff. | Action availability, command execution, pending/error handling and capabilities. |
| Toast facade, if needed | One service, visual theme, accessible announcement and action presentation. | Whether a command succeeded; durable notification delivery. |

New APIs should use the verified HeroUI event/state contract explicitly. Adapt current `onClick`, `disabled`, `asChild` and Radix close/focus props deliberately at migration boundaries; do not forward unsupported props silently. Keep router links as real links. Use native/library composition directly where another Ordo wrapper adds no contract.

## Migration matrix and review gate

| Family | Decision | Qualification before extension |
|---|---|---|
| Logo, app shell/sidebar, layouts, typography hierarchy, project/task card composition | Retain. | Visual comparison and responsive checks of any touched surface. |
| Auth, organization/capability resolution, canonical data, query/request IDs, feature controllers | Retain behavior and ownership. | Existing authentication, isolation and persistence regressions remain authoritative. |
| Buttons and text/password/textarea fields | Pilot in the isolated proof. Consolidate duplicate auth/product mechanics later. | Labels/errors, native submit, pending/draft retry, keyboard/ref behavior and exact dimensions. |
| Select/multiselect/member picker, checkbox/radio/switch | Migrate active families in small batches. | Controlled IDs, keyboard selection, long options, touch and portal theme. |
| Menus/popovers/tooltips/dialogs/drawers | Migrate an interaction family after coexistence proof. | Nested layers, Escape/outside click, close guards, initial/returned focus and scroll lock. |
| Calendar/date fields | Separate deliberate family gate. | Date-only values, presets, clear, invalid/open ranges, calendar keyboard behavior. |
| Form sections, cards, state screens, tables, task surfaces | Retain composition; consume tokens/new controls where useful. | Correct semantics, interactive-row keyboard behavior, loading/error/empty distinctions. |
| dnd-kit and task ordering | Retain; isolate transform ownership. | Pointer/keyboard drag, non-drag equivalent, cancellation, concurrency, failure rollback and selection. |
| Toasts | Converge on one service. | Do not add a third toast system during the proof. Verify theme and announcements. |
| Unused scaffold primitives | No migration merely to reproduce the scaffold. | Confirm indirect/dynamic usage before later removal. |

Before user review, present the isolated proof with pinned normal dependency resolution, TypeScript/build results, meaningful interaction tests, desktop/mobile captures, light/dark portal checks, reduced motion, and explicit unexercised cases. The proof must show a drawer with a nested selector/date control and a menu action opening an editor, not just static controls.

User approval of that concrete result is the gate for expanding adoption. A broad React/Tailwind/HeroUI migration, production deployment, a new font, a changed visual world or a production dark theme is not implied by this document. Apply the compatibility audit's platform, peer-dependency, real foundation-journey and regression gates to any later application adoption.

## Completed proof

See [proof results and handoff](heroui-v3-proof-results.md) for actual verification, the failed mixed-overlay gate, proposed contrast corrections, motion adapter and remaining adoption criteria. The proof is complete; full application adoption awaits review.
