---
description: Execute a plan file — one builder per file, verifier at the end (flash)
agent: build
---

Execute this plan: @$1

Rules:

1. Read the whole plan first. If a task has no `Anchor`, send `@investigator` to find one
   before dispatching a builder to it.
2. Dispatch `@builder` per task. Tasks listed under `## Parallel` go out together; every
   other task waits for the one it depends on.
3. One builder never receives two files. If a task names two, split it.
4. After the last builder returns, run `@verifier`.
5. If verification fails, send the failing `file:line` and the exact error to a builder as
   a new task. Do not fix it yourself and do not re-run the whole plan.
6. Append a `## Executed` section to the plan file: task number, path, and pass or fail.

Report: tasks done, files touched, verifier result. Not the transcript.
