#!/usr/bin/env bash
# Builds a canonical release candidate. Intentionally never publishes or touches Hostinger.
set -euo pipefail
if [[ $# -ne 0 ]]; then echo "No arguments supported; this script only prepares a release candidate." >&2; exit 2; fi
cd "$(git rev-parse --show-toplevel)"
if [[ "$(git branch --show-current)" != "codex/heroui-v3-proof" ]]; then
  echo "Refusing to build outside the approved canonical source branch." >&2; exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to build with uncommitted files." >&2; exit 1
fi
npm ci
npm run typecheck
npm run lint:foundation
npm test -- --maxWorkers=2
npm run test:foundation:safety
npm run build:foundation:production
output="dist-foundation-hosted"
[[ -f "$output/index.html" ]] || { echo "Canonical output is missing." >&2; exit 1; }
if grep -REl '127\\.0\\.0\\.1:54321|localhost:54321|ilvqopsvyacegotplstw|sb_secret_|service_role|\.foundation-runtime/' "$output" >/dev/null; then
  echo "Build includes forbidden local, legacy or privileged identifiers." >&2; exit 1
fi
printf 'Prepared canonical artifact for %s at %s. NOT PUBLISHED.\n' "$(git rev-parse HEAD)" "$output"
printf 'Hosted auth, schema, tenancy and persistence gates must pass before publishing the artifact branch.\n'
