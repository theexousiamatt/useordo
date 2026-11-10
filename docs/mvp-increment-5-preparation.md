# Increment 5 preparation — Basic Client Experience

Prepared after Increment 4 verification. This is the next implementation handoff, not a new architecture exercise or a claim that the client portal is implemented.

## Reuse

Existing real Auth, independent client businesses/contacts, contact→profile binding, client access-grant scaffolding, project/context relationships, milestones, private assets/storage, command receipts and audit history. Existing client grants describe audiences; they do **not** currently expose internal projects/tasks/files. Keep that boundary.

## Small implementation sequence

1. **Client access and project visibility:** client-only entry point with safe project projections, authenticated contact/profile matching, active client/project grants, explicit reviewer/approver permissions and revocation. Studio staff can grant appropriate access; a single business owner may hold both review and approval rights. Do not grant clients studio production/context membership. Do not reuse legacy client hooks with canonical IDs.
2. **Explicit submissions:** minimal deliverable/version and publication records, with draft private by default and an authorized Publish command. Support approved HTTPS Figma/Drive references, private files and handover notes. Show only published project progress/updates/actions and versions; never return raw project/commercial/internal-task records through the portal.
3. **Feedback and decisions:** feedback bound to the published version and explicit version-specific approval/change requests, with authorized actor checks, request IDs and stale-version protection. Keep internal feedback private. A newer draft must not inherit a prior version's approval.
4. **Basic material collection and permanent library:** requested/submitted/under-review/accepted/changes-required material states and private uploads where required; approved assets, links and approval history remain accessible when studio projects are archived. Use existing private-storage boundaries and publication checks before downloads.

## Required safety checks

Two studios and two unrelated clients; direct route/RPC/storage attempts against unpublished/internal material; revoked grants; wrong project/version IDs; duplicate/retried feedback/decisions; single-owner review+approval; published archive access; desktop/mobile client journey. Existing `/tasks` and production commands must continue denying client access. No public-bucket shortcut or automatic publication.

Start with slice 1 against the current canonical schema and tests. Add only the minimal missing publication/review structures in forward migrations. Email automation, advanced notifications, broader component migration and visual perfection stay deferred. Keep production untouched; deployment still requires approval.
