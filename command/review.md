---
description: Severity-tagged review of the current diff, or of a path you name
agent: build
subtask: true
---

Send `@reviewer` at this. Target: $ARGUMENTS — if that is empty, review the uncommitted
diff below.

!`git diff HEAD --stat 2>/dev/null | tail -20`

!`git diff HEAD 2>/dev/null | head -600`

Return the findings table only. No praise, no summary of what the code does.
