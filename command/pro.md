---
description: Answer one hard question on deepseek-v4-pro, then drop back to flash
agent: build
model: deepseek/deepseek-v4-pro
---

$ARGUMENTS

This one turn runs on `deepseek-v4-pro`, roughly 3x the cost of flash. It is here for
architecture calls, a bug that has already survived two honest attempts on flash, and
anything whose cost of being wrong exceeds the token bill.

Use the room. Reason it through properly, state the assumption you are betting on, and say
what would prove you wrong.

Subsequent turns return to flash automatically.
