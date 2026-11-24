---
description: Fetch a URL, answer a question from it, and save the answer as a reusable note
agent: build
---

Fetch `$1` and answer: $2

Then write `.opencode/notes/<slug>.md`:

```markdown
# <title>
source: <url>
fetched: <today's date>
applies to: <package@version, or "n/a">

## Question
<the question asked>

## Answer
<the answer>

## Quotes
> <the shortest decisive passage>

## Not covered
<what the page did not answer>
```

The point of the file is that the next session reads it instead of paying to fetch and
re-read the page. Write it for that reader: no narration, quotes exact, URL always
present so it can be re-checked when it goes stale.

Print the note path when done.
