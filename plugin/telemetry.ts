/**
 * telemetry — live cost and cache-hit ratio, per session.
 *
 * The cache-hit ratio is the number that matters. A cached input token costs 1/50th of a
 * fresh one, so a session sitting at 90% hit rate is effectively free while the same work
 * at 10% is not. `opencode stats` only tells you this after the fact; this tells you while
 * you can still do something about it.
 *
 * Everything is wrapped so a failure here can never break a session.
 */

const PRICE: Record<string, { in: number; out: number; hit: number }> = {
  "deepseek-v4-flash": { in: 0.14, out: 0.28, hit: 0.0028 },
  "deepseek-v4-pro": { in: 0.435, out: 0.87, hit: 0.003625 },
}

type Totals = { input: number; output: number; read: number; write: number; cost: number }

const totals = new Map<string, Totals>()
const seen = new Set<string>()

const blank = (): Totals => ({ input: 0, output: 0, read: 0, write: 0, cost: 0 })

function cost(modelID: string, t: Totals) {
  const p = PRICE[modelID]
  if (!p) return 0
  return (
    (t.input * p.in + t.write * p.in + t.read * p.hit + t.output * p.out) / 1_000_000
  )
}

function money(n: number) {
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(3)}`
  return `$${n.toFixed(4)}`
}

export const Telemetry = async ({ client }: any) => {
  const toast = async (message: string, variant = "info") => {
    try {
      await client.tui.showToast({ body: { message, variant } })
    } catch {
      try {
        await client.tui.showToast({ message, variant })
      } catch {
        /* headless or older server — silent */
      }
    }
  }

  return {
    event: async ({ event }: any) => {
      try {
        if (event.type === "message.updated") {
          const info = event.properties?.info
          if (!info || info.role !== "assistant") return
          // Assistant messages stream many updates; count each message id once, at the end.
          const key = `${info.sessionID}:${info.id}`
          if (!info.tokens || seen.has(key)) return
          if (!info.time?.completed) return
          seen.add(key)

          const t = totals.get(info.sessionID) ?? blank()
          t.input += info.tokens.input ?? 0
          t.output += info.tokens.output ?? 0
          t.read += info.tokens.cache?.read ?? 0
          t.write += info.tokens.cache?.write ?? 0
          t.cost += typeof info.cost === "number" ? info.cost : cost(info.modelID, {
            ...blank(),
            input: info.tokens.input ?? 0,
            output: info.tokens.output ?? 0,
            read: info.tokens.cache?.read ?? 0,
            write: info.tokens.cache?.write ?? 0,
          })
          totals.set(info.sessionID, t)
          return
        }

        if (event.type === "session.idle") {
          const id = event.properties?.sessionID
          const t = id && totals.get(id)
          if (!t) return

          const fresh = t.input + t.write
          const hitRate = fresh + t.read > 0 ? Math.round((t.read / (fresh + t.read)) * 100) : 0
          const ctx = fresh + t.read + t.output

          const warn = hitRate < 50 && ctx > 50_000
          await toast(
            `${money(t.cost)} · cache ${hitRate}% · ctx ~${Math.round(ctx / 1000)}K` +
              (warn ? " · prefix churning" : ""),
            warn ? "warning" : "info",
          )
        }

        if (event.type === "session.compacted") {
          await toast("compacted — prefix rebuilt, next turn pays full input price", "warning")
        }
      } catch {
        /* never break a session over telemetry */
      }
    },
  }
}
