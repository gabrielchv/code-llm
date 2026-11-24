/**
 * guardrail — stop token-bomb tool calls before they reach the model's context.
 *
 * Every rule here rejects with the corrected command in the error message. That matters:
 * a bare refusal makes deepseek-v4-flash retry the same thing, while a refusal carrying
 * the fix makes it retry correctly. The error text is written for the model, not for you.
 *
 * Nothing here is a security control. It is a cost and quality control. Anything the
 * model genuinely needs is still reachable with a narrower argument.
 */

import { statSync } from "node:fs"

/** Bytes above which an unbounded whole-file shell read is refused. */
const MAX_CAT_BYTES = 200_000

/** Lines above which the `read` tool must carry an explicit limit. */
const MAX_READ_LINES = 3_000

/** Characters of tool output above which a warning is attached. */
const MAX_OUTPUT_CHARS = 120_000

type Rule = {
  /** Matches the command string. */
  test: RegExp
  /** Returns an error message, or null to allow. */
  reject: (cmd: string) => string | null
}

const has = (cmd: string, ...flags: string[]) => flags.some((f) => cmd.includes(f))

const RULES: Rule[] = [
  {
    test: /^\s*find\s+(\/|~|\$HOME)(\s|$)/,
    reject: (cmd) =>
      has(cmd, "-maxdepth")
        ? null
        : `Refused: unbounded find from the filesystem root will flood the context.
Search the project instead: rg --files -g '<pattern>'
Or bound it: ${cmd.replace(/^\s*find\s+/, "find ")} -maxdepth 3`,
  },
  {
    test: /\bgrep\s+(-\w*[rR]|--recursive)/,
    reject: (cmd) =>
      has(cmd, "--include", "--exclude-dir", "-l", "--files-with-matches", "| head", "|head")
        ? null
        : `Refused: recursive grep with no file filter reads node_modules, .git, and build output.
Use ripgrep, which respects .gitignore by default:
  ${cmd.replace(/\bgrep\s+(-\w*[rR]|--recursive)\s*/, "rg ")}
Or add a filter: --include='*.ts'`,
  },
  {
    test: /^\s*(cat|less|more|bat)\s+\S/,
    reject: (cmd) => {
      const path = cmd.split(/\s+/).slice(1).find((a) => !a.startsWith("-"))
      if (!path || path.includes("*")) return null
      let size = 0
      try {
        size = statSync(path).size
      } catch {
        return null
      }
      if (size <= MAX_CAT_BYTES) return null
      return `Refused: ${path} is ${Math.round(size / 1024)}KB. Reading it whole would consume a large share of the useful context window.
Use the read tool with offset and limit, or narrow first:
  rg -n '<pattern>' ${path} | head -50`
    },
  },
  {
    test: /^\s*git\s+log\b/,
    reject: (cmd) =>
      has(cmd, "-n", "--max-count", "| head", "|head", "-1", "-2", "-3", "-5", "--since", "--oneline")
        ? null
        : `Refused: git log with no bound prints the entire history.
  ${cmd.replace(/^\s*git\s+log\b/, "git log --oneline -20")}`,
  },
  {
    test: /^\s*npm\s+(ls|list)\b/,
    reject: (cmd) =>
      has(cmd, "--depth")
        ? null
        : `Refused: npm ls prints the full dependency tree.
  ${cmd.trimEnd()} --depth 0`,
  },
  {
    test: /\bdocker\s+(compose\s+)?logs\b/,
    reject: (cmd) =>
      has(cmd, "--tail", "-n")
        ? null
        : `Refused: container logs are unbounded.
  ${cmd.trimEnd()} --tail 100`,
  },
  {
    test: /^\s*ls\s+(-\w*R|--recursive)/,
    reject: (cmd) =>
      has(cmd, "| head", "|head")
        ? null
        : `Refused: recursive ls descends into node_modules and .git.
  rg --files | head -100
Or list one level: ${cmd.replace(/-\w*R/, "-la")}`,
  },
]

export const Guardrail = async () => {
  return {
    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool === "bash") {
        const cmd: string = output.args?.command ?? ""
        for (const rule of RULES) {
          if (!rule.test.test(cmd)) continue
          const message = rule.reject(cmd)
          if (message) throw new Error(message)
        }
        return
      }

      if (input.tool === "read") {
        const path: string = output.args?.filePath ?? output.args?.path ?? ""
        if (!path || output.args?.limit) return
        let lines = 0
        try {
          lines = statSync(path).size / 40 // ~40 bytes per line, cheap estimate
        } catch {
          return
        }
        if (lines <= MAX_READ_LINES) return
        throw new Error(
          `Refused: ${path} is roughly ${Math.round(lines)} lines. Reading it whole is rarely what you want.
Pass a limit, or find the range first:
  rg -n '<symbol>' ${path} | head -20
then read with offset and limit around the hit.`,
        )
      }
    },

    "tool.execute.after": async (input: any, output: any) => {
      const text: string = output?.output ?? ""
      if (typeof text !== "string" || text.length <= MAX_OUTPUT_CHARS) return
      output.output =
        text.slice(0, MAX_OUTPUT_CHARS) +
        `\n\n[guardrail: truncated ${text.length - MAX_OUTPUT_CHARS} characters. ` +
        `Re-run with a narrower filter rather than paging through this.]`
    },
  }
}
