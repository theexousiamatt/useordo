# Ordo control foundation

Use these controls for approved HeroUI feature families; keep complete overlays on one interaction system. Do not insert Select into retained Radix dialogs. Source contracts are the installed HeroUI v3 declarations and [agent guide](../../docs/frontend/heroui-v3-agent-guide.md).

| Component | Contract | Current consumer |
|---|---|---|
| OrdoButton | Explicit native button type; HeroUI onPress; primary/outline/ghost; isDisabled/isPending; stable name, decorative spinner. Feature owns mutation guard/status. | ProjectCreateDialog |
| OrdoTextField | Controlled string/onChange; associated label/hint/error; required/disabled/maxLength; input or textarea. Native date is deliberately separate. | ProjectCreateDialog |
| OrdoSelectField | Controlled scalar ID; explicit empty option maps to empty string; labelled required/disabled; Ordo portal scope on actual popover. | ProjectCreateDialog |

`styles.css` supplies reviewed Ordo semantic roles and the HeroUI adapter. Legacy HSL channels retain a separate namespace. Preserve system fonts, 12px controls, native date-only semantics, and Ordo custom task cards. No feature data, backend calls or authorization decisions belong in wrappers. Use HeroUI directly when a wrapper adds no reusable contract. This is a scoped first family, not approval to replace all existing controls.

See [Phase 2.0 verification](../../docs/frontend/phase-2-0-verification.md) for tests, evidence, remaining gates and rollback.
