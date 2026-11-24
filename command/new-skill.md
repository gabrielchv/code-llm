---
description: Scaffold a SKILL.md that both OpenCode and Claude Code discover
agent: build
---

Create a skill for: $ARGUMENTS

Write it to `~/.claude/skills/<name>/SKILL.md`. That path is read by OpenCode natively and
by Claude Code, so one file serves both.

Frontmatter, exactly these fields:

```yaml
---
name: <lowercase-kebab, 1-64 chars, letters digits hyphens only>
description: <when to use this, specific enough that a model picks it correctly and does not pick it wrongly>
---
```

Body rules:

- Open with what the skill produces, not what it is about.
- Numbered steps the model follows in order. No prose paragraphs of philosophy.
- Show output shapes in fenced blocks rather than describing them.
- Keep it under ~150 lines. Anything longer belongs in a `references/` file beside it,
  named from the body so it is read only when needed.

The `description` is the entire basis on which a model decides to load this. Spend your
effort there.

After writing, print the path and the one-line description.
