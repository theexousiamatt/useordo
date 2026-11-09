# HeroUI v3 agent guide for Ordo

Reviewed 4 November 2026. Read this guide **before coding a HeroUI component**, together with the [compatibility audit](./heroui-v3-compatibility.md), the target package's instructions, and the affected Ordo wrapper and feature tests.

## Scope and version ground truth

HeroUI is being evaluated in the separate `ordo-heroui-v3-proof` worktree, under `experiments/heroui-v3`. That package owns its dependencies, styles, synthetic state and verification. The main application's React 18/Tailwind 3 stack is not implicitly upgraded by this guide. Keep the evaluation independent of backend requests, environment files and production operations.

The audited proof pins are `@heroui/react` and `@heroui/styles` **3.2.7**, React/DOM **19.3.1**, React type packages **19.3.0**, and Tailwind/Vite plugin **4.3.4**. A manifest records intent; the target package's committed lockfile and resolved graph establish what was installed. Do not claim a package is installed or a migration is complete from its declared version alone.

Before a component change:

1. Confirm the working directory and its applicable `AGENTS.md`; inspect that package's manifest and lockfile. Keep React/DOM and their type packages aligned, and HeroUI React/styles at the reviewed matching version.
2. Read the official **v3 React** component page or its MDX, including anatomy, controlled examples, accessibility and prop ownership. Read related React Aria guidance for behavior that HeroUI delegates.
3. Inspect the installed package's exported `.d.ts` declarations and implementation when examples conflict. Use the installed release's declarations as the executable contract; live documentation and branch source can advance beyond it. Resolve genuine documentation/type discrepancies explicitly rather than bypassing types with `any`.
4. Read the existing Ordo caller contract: IDs, controlled values, refs, submit behavior, draft retention, errors, pending operations and close guards. Migrate that behavior deliberately.

Official starting points: [quick start](https://heroui.com/en/docs/react/getting-started/quick-start), [component catalog](https://heroui.com/en/docs/react/components), [composition](https://heroui.com/en/docs/react/getting-started/composition), [releases](https://heroui.com/en/docs/react/releases), [React package source](https://github.com/heroui-inc/heroui/blob/v3/packages/react/package.json) and [styles package source](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/package.json). Component MDX is available through the documented page's `.mdx` form where published; use the HTML page or installed source when it is unavailable.

## v3 setup and style ownership

The supported React setup requires React 19+ and Tailwind 4. Import Tailwind before HeroUI styles in the approved stylesheet entry. HeroUI v3 needs no `HeroUIProvider` and no Framer Motion installation. Do not add v2 providers, `@heroui/theme` plugin setup or a motion dependency from remembered NextUI examples. See [framework setup](https://heroui.com/en/docs/react/getting-started/frameworks) and [v3 migration reference](https://heroui.com/en/docs/react/migration/full-migration).

Use one Tailwind reset per document. Ordo's legacy `--background`, `--accent`, `--border` and related variables contain HSL channels; HeroUI consumes complete colors and some semantic names mean different things. Follow the reviewed Ordo token adapter and [HeroUI theming](https://heroui.com/en/docs/react/getting-started/theming). Never globally overwrite legacy variables with full colors or feed HSL channel triples into HeroUI's color properties.

Theme the actual portal root as well as triggers. A theme scoped only to a parent card or `.client-os` does not automatically reach content portalled to `document.body`. Verify foregrounds, surfaces, borders and focus states in each supported theme. Retain Ordo's typography, spacing and surface composition through shared tokens; the component library does not determine the product layout.

## Component contracts: do not translate props by habit

HeroUI components have distinct contracts. `isDisabled` is common on React Aria composites, while the primitive `Input` uses native `disabled`. Read the component rather than applying one blanket rename.

| Intent | v3 contract and Ordo adaptation |
|---|---|
| Button activation | Prefer `onPress` for an action; its event is a React Aria press event. Choose `type="button"` or `type="submit"` deliberately. Do not attach both press and click handlers to invoke the same mutation. |
| Button availability/loading | Use `isDisabled` and `isPending`; a pending visual state does not replace the feature's duplicate-submission guard. Keep a meaningful accessible name while showing progress. |
| Primitive Input | Native `value` and `onChange(event)`; read `event.target.value`. Native `disabled`, `readOnly`, `required`, `name` and autocomplete props belong here. |
| TextField root | Its `value`/`onChange` contract supplies a string, with `isDisabled`, `isReadOnly`, `isRequired` and validation state. Compose imported `Label`, `Input`/`TextArea`, `Description` and `FieldError`. Choose one controlled-state owner instead of conflicting root/child handlers. |
| Select | Current v3 uses `value` and `onChange(value)` with `Key`, `Key[]` or `null`, plus `selectionMode`. Adapt intentionally to Ordo's scalar or array IDs. Do not assume Radix `onValueChange` or another library version's `selectedKeys`. |
| Checkbox | Use `isSelected` and boolean `onChange`; handle indeterminate state separately. Compose `Checkbox.Content`, `Control` and `Indicator` with label text; avoid nesting another HTML label inside the clickable label. |
| Rendered element | v3 supports documented `render`/composition or style variants on another element. Radix `asChild` and Slot forwarding are not interchangeable APIs. Preserve DOM semantics, refs and event ownership. |
| States/styles | Use the component's documented data attributes and BEM/slot classes. Radix `data-state=open` selectors do not automatically describe HeroUI state. |

Sources: [Button](https://heroui.com/en/docs/react/components/button), [Input](https://heroui.com/en/docs/react/components/input), [TextField](https://heroui.com/en/docs/react/components/text-field), [Select](https://heroui.com/en/docs/react/components/select), [Checkbox](https://heroui.com/en/docs/react/components/checkbox) and [composition](https://heroui.com/en/docs/react/getting-started/composition).

Compound parts must retain their required hierarchy. For example, a Select composes a label, `Select.Trigger` with `Select.Value`/`Indicator`, then `Select.Popover` containing a `ListBox` and keyed items. Provide text equivalents for rich option content so labels and keyboard search work. Preserve clear-to-null behavior instead of coercing every selection through `String(value)`.

For date controls, read the [DatePicker contract](https://heroui.com/en/docs/react/components/date-picker) and installed date types before writing an adapter. Ordo deadlines remain date-only `YYYY-MM-DD` values with local calendar semantics. A replacement widget must preserve clearing, inclusive ranges and Monday–Sunday reporting without introducing timezone shifts.

## Overlays, pending saves and Radix coexistence

Prop ownership matters. In the documented v3 Modal, `Modal.Backdrop` owns `isOpen`, `onOpenChange`, `isDismissable`, `isKeyboardDismissDisabled` and the optional `UNSTABLE_portalContainer`; `Modal.Container` owns placement, size and scrolling; `Modal.Dialog` owns dialog content and its accessible identity. Do not put Radix's `open` prop or root-level dismissal assumptions on the wrong part. Confirm the matching Drawer/Popover contracts independently. See [Modal](https://heroui.com/en/docs/react/components/modal), [Drawer](https://heroui.com/en/docs/react/components/drawer) and [Popover](https://heroui.com/en/docs/react/components/popover).

The feature controller owns one close-request path. Apply pending/dirty guards to Escape, backdrop, header close, Cancel, navigation and save completion. Unconditional close slots/triggers must not bypass that policy. A pending operation must retain its draft and report failure before allowing a retry; cancellation must never pretend that an already-sent mutation was rolled back.

Keep a deliberate mixed-library stress case: a HeroUI selector inside a retained Radix sheet. Verify outside interaction, stacking, scroll locking, focus trapping and return focus. Avoid patching these with arbitrary timers. Prefer migrating a complete overlay family once its behavior is proven.

dnd-kit retains ownership of the draggable node's transform. HeroUI's pressed-scale styling must not overwrite it. Use a dedicated drag handle and test interactive card controls, pointer activation, keyboard sorting, cancellation, announcements and focus after movement. Library styling must not duplicate canonical task records or own ordering persistence.

## Thin Ordo wrappers and feature boundaries

Wrap a component only when Ordo has a stable reusable contract: `OrdoButton` for product variants/pending presentation, `OrdoTextField` for label/hint/error associations, recurring member presentation, and dialog/drawer layout and close-request conventions. Use HeroUI directly for ordinary composition where another wrapper adds no contract. Keep wrapper imports away from Supabase and feature-specific mutations.

Feature controllers retain authorization/capability results, entity IDs, local drafts, request IDs, optimistic revisions, mutations, conflict recovery and notification decisions. Backend commands and RLS remain authoritative. A disabled control is a UI state, not permission enforcement. A successful local preview is not evidence of saved work or a completed account/invitation journey.

Preserve existing environment guards, target validation, identity-scoped cache clearing and approved backend APIs. The isolated proof uses synthetic state and makes no backend calls. Broader adoption requires its separate reviewed platform/peer migration and regression gate from the compatibility audit.

## Documentation tooling: optional and scoped

The [official MCP server](https://heroui.com/en/docs/react/getting-started/mcp-server) is `@heroui/react-mcp`, currently v3 React documentation over stdio. If already connected, use its component docs/source/styles and theme tools for the specific component. Its current documentation requires Node 22+. Tool results describe the current docs release; compare them with local declarations.

The [official CLI](https://heroui.com/en/docs/react/getting-started/cli) currently requires Node 22.22.0+. `info`/`doc` expose APIs, `list` reports packages and `doctor` checks dependency health. These tooling requirements do not establish a higher browser-app runtime requirement.

Do not install tools globally or modify user-wide MCP configuration merely to read documentation. Web pages, MDX and installed declarations are sufficient. If tool installation is authorized, pin its reviewed version and scope it to the evaluation package. CLI `install`/`upgrade` mutate dependencies; `agents-md` changes instruction/cache files, and `design-md` replaces its destination. Never point downloaded guidance at Ordo's authored instructions or design context without reviewing the proposed output.

After a deliberate dependency upgrade, inspect the lockfile diff and resolved peers, read that release's changes, and refresh relevant cached `.heroui-docs`/MCP/CLI references. Record the installed version beside any cached examples. A cache generated from a live v3 branch is a reference, not a version pin or permission to auto-upgrade.

## Verification before calling a component complete

Run the target package's typecheck, appropriate behavior tests and production build after implementation. Inspect the rendered result at supported widths/themes. Cover label/error association, keyboard activation, native submit behavior, controlled values/clearing, pending duplicate prevention, failed-save draft/retry, all dismissal paths, nested overlays, focus return, portal colors, reduced motion and drag behavior where affected.

Retain the current application tests for migrated families. Test user outcomes rather than duplicating library internals, and use a real browser for layout, touch, focus and dragging. Add narrow missing browser shims only when a test demonstrates the need; a jsdom-only pass does not certify those interactions. Record unexercised cases and the exact proof boundary in the result.

## Verified proof constraints

Do not compose HeroUI selectors inside retained Radix modals: the evaluated composition fails Escape/focus behavior. Migrate overlay families together. Pending spinner must remain decorative; saving announcements and dirty-close guards belong to the feature. See [proof results](heroui-v3-proof-results.md) for the pinned motion adapter and actual verification limits.
