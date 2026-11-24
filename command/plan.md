---
description: Turn a request or a grill spec into an ordered file-level plan (pro)
agent: plan
---

Plan this: $ARGUMENTS

Read the real code before writing a single task. Produce file-level tasks with anchors, in
execution order, and name the exact verification command. Write the plan to
`.opencode/plans/<slug>.md` and print the path.

Current state for reference:

!`git status --short 2>/dev/null | head -30`
