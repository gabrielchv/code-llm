---
description: Spend and cache-hit ratio, lifetime and today
agent: build
---

!`opencode stats 2>/dev/null`

Read the numbers above and tell me, in four lines:

1. Total spend, and spend per session.
2. Cache read tokens as a percentage of all input tokens. Anything under 50% means the
   prefix is churning — say what is most likely churning it.
3. Output tokens as a share of total. Output costs 2x input on flash and 100x a cache hit,
   so a high output share is where the money actually goes.
4. One concrete change that would move the biggest of those numbers.

Reference prices, flash: cache hit `$0.0028/M`, miss `$0.14/M`, output `$0.28/M`.
Pro: `$0.003625` / `$0.435` / `$0.87`.
