# Ordo HeroUI v3 isolated proof

UI evaluation only; synthetic state resets on reload. No backend connection.

From this directory:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Preview: http://127.0.0.1:5190/. Dependencies are pinned in the package lock. Do not install this package into the root application.

Read [results and handoff](../../docs/frontend/heroui-v3-proof-results.md), [audit](../../docs/frontend/heroui-v3-compatibility.md), and [API guide](../../docs/frontend/heroui-v3-agent-guide.md).

Known diagnostic failure: the retained Radix drawer plus HeroUI selector can both dismiss on Escape. That sample is explicitly not approved for adoption. All-HeroUI nested controls were checked separately. Pointer/touch drag and full application platform migration remain later gates. Dark is experimental.

Rollback: return to the original `ordo` checkout; no database changes exist. Preserve existing uncommitted work. Broader migration requires review.
