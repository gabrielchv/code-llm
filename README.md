# code-llm

OpenCode configured to run entirely on DeepSeek V4. Zero Anthropic spend.

Everything here is symlinked into `~/.config/opencode`, so every change is diffable and
one `git checkout` from reverted.

## Layout

```
opencode.json      models, context limits, compaction, permissions
AGENTS.md          global rules — the cache prefix every session starts from
agent/             8 agents: 5 flash workers, 3 pro thinkers
command/           14 slash commands — the daily surface
plugin/            guardrail (blocks token bombs), telemetry (live cost + cache%)
skills/            19 skills ported from Claude Code plugins
scripts/link.sh    idempotent symlinker
```

## Models

| Model | Context | Max output | Input | Output | Cache read |
|---|---|---|---|---|---|
| `deepseek/deepseek-v4-flash` | 1,000,000 | 384,000 | $0.14/M | $0.28/M | $0.0028/M |
| `deepseek/deepseek-v4-pro` | 1,000,000 | 384,000 | $0.435/M | $0.87/M | $0.003625/M |

Flash does the work. Pro does the thinking — it is wired into exactly three agents
(`grill`, `plan`, `compaction`) where being wrong is more expensive than the tokens. One
turn can be forced onto pro with `/pro <question>`.

DeepSeek is a first-class provider in OpenCode's registry, so no custom provider block is
needed for auth. The `provider` block in `opencode.json` exists for one reason only — see
Context below.

## Context strategy

This is the part that is not obvious from the docs, so it is written down.

OpenCode decides when to compact with this, read out of the shipped binary:

```js
let l = cfg.compaction?.reserved ?? Math.min(20000, maxOutputTokens(model))
return model.limit.input
  ? Math.max(0, model.limit.input - l)             // reserved is USED
  : Math.max(0, context - maxOutputTokens(model))  // reserved is IGNORED
```

models.dev publishes DeepSeek as `{context: 1000000, output: 384000}` with **no `input`
field**, so out of the box you land in the second branch: compaction fires at **616,000
tokens** and `compaction.reserved` does nothing at all.

616K is far past where the model is still sharp. Published MRCR 8-needle numbers for V4:
above 0.82 through 256K, 0.49 at 1M. So the default means every long session runs degraded
for hundreds of thousands of tokens before anything happens.

Fix, in `opencode.json`:

- `provider.deepseek.models.*.limit.input` — 200K flash, 320K pro. Setting this moves you
  into the first branch, which makes `reserved` live.
- `compaction.reserved: 20000` — so the summarization backstop lands at **180K on flash**
  (70% of the 256K high-fidelity zone, matching the published guidance of 70–75%) and
  **300K on pro**.
- `compaction.prune: true` — off by default. Pruning drops old tool outputs while
  protecting the most recent 40K (`PRUNE_PROTECT`), and only fires when at least 20K is
  removable (`PRUNE_MINIMUM`). It costs no model call, adds no latency, and never rewrites
  anything — so unlike summarization it cannot lose track of which files were edited. In a
  coding session tool output is most of the context, so pruning alone usually keeps you
  under the backstop and summarization never fires at all.
- `compaction.tail_turns: 4` and `preserve_recent_tokens: 40000` — both undocumented. The
  default for `preserve_recent_tokens` resolves to 8,000, which is not enough verbatim
  edge to continue a coding task.

The `compaction` agent is also overridden here: pro, temperature 0, and a fixed template
with a `## Files modified` section. Published probes score summarizers 2.19–2.45 out of 5
on artifact tracking — losing exactly the fact a coding agent most needs. **If compaction
ever misbehaves, `agent/compaction.md` is the first thing to delete;** everything else in
this repo is independent of it.

Practical habit that beats all of the above: start a new session per task. Repeated
compaction compounds loss, and a fresh session rebuilds the cheap cached prefix anyway.

## Agents

| Agent | Model | Does | Cannot |
|---|---|---|---|
| `grill` | pro | One-question-at-a-time interview, writes a spec | Edit source, run shell |
| `plan` | pro | File-level implementation plan with anchors | Edit source, write outside plans |
| `compaction` | pro | Structured session summary | — (internal) |
| `agent-smith` | flash | Writes new agent definitions | Touch anything but `agent/` and `AGENTS.md` |
| `investigator` | flash | Locates code, returns a `file:line` table | Edit, run anything but read-only git/find |
| `builder` | flash | Bounded 1-2 file edits, returns a diff receipt | Run any shell command at all |
| `reviewer` | flash | Severity-tagged findings on a diff or file | Edit, run anything but read-only git |
| `verifier` | flash | Runs build/typecheck/lint/tests | Edit, or fix what it finds |
| `scout` | flash | External library research with citations | Edit, run shell |

Invoke with `@name`, or let the primary delegate. `subagent_depth` is 1 — subagents cannot
spawn subagents.

`builder` having no shell access is deliberate. Verification is `verifier`'s job, and
splitting the two means a bad edit cannot mark its own homework.

New agents come from `/new-agent <description>`, which writes a template-conforming file
and defaults it to `hidden: true`. Roster size is what degrades flash's agent selection, so
new agents stay invisible until promoted.

## Commands

| Command | What |
|---|---|
| `/grill <thing>` | Stress-test a plan. Pro. Ends by writing `.opencode/plans/<slug>.md` |
| `/plan <thing>` | Ordered file-level tasks with anchors. Pro |
| `/implement <plan>` | Executes a plan: one builder per file, verifier at the end |
| `/verify` | Build, typecheck, lint, tests. Pass/fail only |
| `/review [path]` | Reviewer on the current diff, or a path |
| `/ship [scope]` | Conventional commit written from the real diff. Never pushes |
| `/new-agent <desc>` | Scaffolds a subagent |
| `/new-skill <desc>` | Scaffolds a SKILL.md into `~/.claude/skills` |
| `/graphify [args]` | Builds the knowledge graph, then self-wires it as project MCP |
| `/scout <question>` | External research, primary sources with URLs |
| `/docs <url> <q>` | Fetch, answer, and save a reusable note |
| `/pro <question>` | One turn on pro |
| `/flash <question>` | One turn on flash |
| `/cost` | Spend and cache-hit ratio, with what to fix |

Commands are expanded when typed, so they cost nothing until used. A wide roster is free;
a wide *agent* roster is not.

## Plugins

- `plugin/guardrail.ts` — rejects token-bomb tool calls (`find /`, unfiltered `grep -r`,
  `cat` on a 200KB+ file, unbounded `git log`, `npm ls`, `docker logs`, `ls -R`) and
  unbounded reads of very large files. Every rejection carries the corrected command,
  because a bare refusal makes flash retry the same thing while a refusal with the fix
  makes it retry correctly. Also truncates any single tool output over 120K characters.
- `plugin/telemetry.ts` — toasts running cost, cache-hit ratio, and context size when the
  session goes idle, and warns on compaction. Fully wrapped in try/catch; a failure here
  cannot break a session.

Neither plugin is load-bearing. Delete either one and everything else still works.

## Skills

Two sources, both discovered automatically:

- `skills/` — 19 ported from Claude Code plugins (superpowers 6.2.0, caveman). A snapshot,
  forked at port time. It does not receive upstream updates.
- `~/.claude/skills` — read live. Your own skills stay in one place and both tools see
  them. Nothing under `~/.claude` is written to by this setup, except by `/new-skill`,
  which creates new skill folders there on request.

Two caveman skills were deliberately not ported: `cavecrew` (superseded by the roster in
`AGENTS.md`, and it names Claude-only agent ids) and `caveman-stats` (parses Claude Code
transcripts; `opencode stats` is the replacement here).

## Credentials

The DeepSeek key is **not** in this repo and must never be. It lives in
`~/.local/share/opencode/auth.json`, written by:

```bash
opencode providers login     # choose DeepSeek, paste the key
```

That store is read by OpenCode on demand rather than exported into the environment of
every process your shell starts.

## Setup on a new machine

```bash
npm i -g opencode-ai@latest        # needs >= 1.14.24 for DeepSeek V4
git clone <this repo> ~/Documents/code-llm
~/Documents/code-llm/scripts/link.sh
opencode providers login
opencode agent list                # 14 rows: 7 built-in, 7 from this repo
```

## Known limits

- **Text-only model.** No vision, no OCR, no PDF. Not fixable here — V4 has no image
  modality.
- **Tool-calling is the weak link** in this model family. `AGENTS.md` encodes discipline
  around it, `guardrail.ts` enforces part of it mechanically, and `verifier` catches the
  rest.
- **Harness speed.** OpenCode's agent loop is slower than Claude Code's on the same model.
- **Single provider.** A DeepSeek outage stops work. DeepSeek has announced a 2x peak-hour
  billing multiplier for 09:00–12:00 and 14:00–18:00 Beijing time, with no effective date
  given.
- **Forked skills.** `skills/` no longer tracks upstream superpowers or caveman.
- **`limit.input` is an override of registry metadata.** If models.dev later publishes a
  real `input` limit for DeepSeek, this block wins over it. Revisit if the numbers move.

## Rollback

Claude Code is untouched. To unwind entirely:

```bash
rm ~/.config/opencode/{opencode.json,AGENTS.md,agent,command,plugin,skills}
mv ~/.config/opencode/opencode.jsonc.stub-bak ~/.config/opencode/opencode.jsonc
npm rm -g opencode-ai
```
