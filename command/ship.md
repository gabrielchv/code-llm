---
description: Stage, write a conventional commit from the real diff, and commit
agent: build
---

Commit the current work. Scope hint: $ARGUMENTS

Diff:

!`git status --short`

!`git diff HEAD --stat`

!`git diff HEAD | head -800`

Steps, in order:

1. Read the diff above. The commit message describes what the diff actually does — not
   what the task was called.
2. If the diff mixes two unrelated changes, say so and stop. Do not commit a mixed diff.
3. `git add` the intended paths. Never `git add -A` when untracked files are present that
   the diff does not explain.
4. Commit with a conventional message: `type(scope): summary`, imperative, lowercase
   summary, no trailing period. Body only if the *why* is not obvious from the diff.
5. Print the resulting `git log -1 --oneline`.

Do not push. Pushing stays behind its own confirmation.
