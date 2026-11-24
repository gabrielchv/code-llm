#!/usr/bin/env bash
# Symlink this repo's config into ~/.config/opencode.
#
# Per-file rather than a whole-directory symlink, so OpenCode's own runtime state
# (caches, session data) stays out of git. Idempotent — safe to re-run.
#
# Credentials are NOT handled here. They live in ~/.local/share/opencode/auth.json,
# written by `opencode auth login`, and are never part of this repo.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

mkdir -p "$DEST"

link() {
  local src="$REPO/$1" dst="$DEST/${2:-$1}"

  if [ -L "$dst" ]; then
    rm "$dst"
  elif [ -e "$dst" ]; then
    local backup="$dst.pre-code-llm"
    echo "existing non-symlink at $dst — moving to $backup"
    mv "$dst" "$backup"
  fi

  ln -s "$src" "$dst"
  echo "linked $dst -> $src"
}

link opencode.json
link AGENTS.md
link agent
link command
link plugin
link skills

echo
echo "done. verify with:"
echo "  opencode agent list"
echo "  ls ~/.config/opencode/command"
