#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
npm run build
publish_dir="$(mktemp -d)"
trap 'rm -rf "$publish_dir"' EXIT
remote_url="$(git remote get-url origin)"
branch='codex/hostinger-static'
if git ls-remote --exit-code --heads "$remote_url" "$branch" >/dev/null 2>&1; then
  git clone --quiet --single-branch --branch "$branch" "$remote_url" "$publish_dir"
  git -C "$publish_dir" rm -r --ignore-unmatch . >/dev/null
else
  git -C "$publish_dir" init --quiet -b "$branch"
  git -C "$publish_dir" remote add origin "$remote_url"
fi
cp -R dist/. "$publish_dir/"
printf 'Compiled Ordo site for Hostinger. Edit the source branch, then run scripts/publish-hostinger.sh to update this branch.\n' > "$publish_dir/README.md"
git -C "$publish_dir" add .
if git -C "$publish_dir" diff --cached --quiet; then
  echo 'Hostinger build is already current.'
  exit 0
fi
git -C "$publish_dir" commit -m "Publish Ordo build from $(git rev-parse --short HEAD)"
git -C "$publish_dir" push origin "$branch"
