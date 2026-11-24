---
description: Build or query the project knowledge graph, then wire it in as an MCP tool
agent: build
---

Run graphify with: $ARGUMENTS

Current graph state:

!`test -f graphify-out/graph.json && echo "graph exists: $(du -h graphify-out/graph.json | cut -f1)" || echo "no graph in this project"`

!`test -f .opencode/opencode.json && grep -c graphify .opencode/opencode.json || echo "no .opencode/opencode.json"`

Steps:

1. If a graph already exists and `$ARGUMENTS` reads as a natural-language question rather
   than a path or a flag, run `graphify query "<question>"` and answer from that. Do not
   rebuild.
2. Otherwise run `graphify $ARGUMENTS` with the `bash` tool so its output streams. Default
   the path to `.` when none is given. Builds are slow — do not run it inside a shell
   substitution.
3. After a build that produces `graphify-out/graph.json`, self-wire the MCP server if the
   check above shows it is not already wired. Create or merge into `.opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "graphify": {
      "type": "local",
      "command": ["graphify", ".", "--mcp"],
      "enabled": true
    }
  }
}
```

   Merge, never overwrite — that file may already hold project settings.

4. Add `graphify-out/` to the project's `.gitignore` if it is not there. Generated
   artifacts do not belong in git.

5. Tell me the graph node and edge counts, and that a restart of the session is what makes
   the new MCP tools appear.
