/**
 * Qwen35-Agent Tools - CANONICAL tool set
 * Tum yerler (agent.ts, app.js, server.js) bu tool isimlerini kullanir
 */

import type { Tool } from "./agent"
import { bookTools, executeBookTool } from "./book"
import { imageTools, executeImageTool } from "./image"

// === CANONICAL TOOL DEFINITIONS ===
// Model'e gonderilecek tek dogru liste - hepsi ayni isimde olmali
export const fileTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file. Creates directories if needed. CRITICAL: If user does NOT specify a directory, use ONLY the filename like 'hello.txt' - system will automatically save to Desktop (A:\\AI\\qwen35-agent-test-workspace\\). Never use other directories unless user explicitly says so.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path - use just filename (e.g. 'hello.txt') for Desktop, or full path like A:\\AI\\qwen35-agent-test-workspace\\hello.txt. If no directory given, system auto-saves to Desktop." },
          content: { type: "string", description: "File content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read file content. Use for reading code, documents, logs. Supports offset/limit for large files.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read (absolute or Desktop/filename)" },
          offset: { type: "number", description: "Start line (1-indexed, optional)" },
          limit: { type: "number", description: "Max lines to read (optional, default 200)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories. Use for exploring filesystem, Desktop, project folders.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (e.g. A:\\AI\\qwen35-agent-test-workspace or . )" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Edit a file by replacing exact string. Use for precise code fixes. old_string must match exactly (including whitespace). Use read_file first to see content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to edit" },
          old_string: { type: "string", description: "Exact string to replace (must match file content exactly)" },
          new_string: { type: "string", description: "New string to replace with" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file or empty directory. Use with caution.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File or directory path to delete" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_directory",
      description: "Create a directory (including parent directories).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to create" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search text pattern in files (grep). Use for finding code, TODOs, functions. Returns file:line matches.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex or text to search (e.g. 'TODO', 'function\\s+\\w+')" },
          path: { type: "string", description: "Directory to search in (default: Desktop)" },
          include: { type: "string", description: "File glob to include (e.g. '*.ts', '*.py', optional)" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "Move or rename a file/directory.",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Source path" },
          destination: { type: "string", description: "Destination path" },
        },
        required: ["source", "destination"],
      },
    },
  },
]

export const codeTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "run_python",
      description: "Execute Python code and return stdout/stderr. Use for calculations, data processing, testing code.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Python code to execute" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_javascript",
      description: "Execute JavaScript/TypeScript code via Node/Bun and return output. Use for JS/TS testing, quick scripts.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "JavaScript code to execute" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_bash",
      description: "Execute bash/shell command. Use for system operations, git, tests, file ops.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sandbox",
      description: "Test in sandbox - run file in isolated temp directory without affecting real files. Supports Python/JS/TS/Bun. Use for debugging and verification.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "File name to test (e.g. script.py, app.js)" },
          language: { type: "string", enum: ["python", "javascript", "typescript", "bun"], description: "Execution language (auto)" },
          content: { type: "string", description: "Optional: file content (if provided, written to filename)" },
        },
        required: ["filename"],
      },
    },
  },
]

export const extraTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the internet for up-to-date information via DuckDuckGo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch a URL and return its text content (up to 8000 chars). Use for reading web pages, APIs, docs.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch (https://...)" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_info",
      description: "Get system info: OS, cwd, Desktop files, memory, Ollama models. Use for environment overview.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
]

export const allTools: Tool[] = [...fileTools, ...codeTools, ...extraTools, ...imageTools]
export const allToolsWithBook: Tool[] = [...allTools, ...bookTools]

// Desktop fallback for Node execution
const DESKTOP_FALLBACK = "A:\\AI\\qwen35-agent-test-workspace"

function resolveNodePath(p: string): string {
  if (!p) return p
  // absolute Windows path
  if (/^[A-Za-z]:[\\/]/.test(p)) return p
  // Desktop/xxx -> Desktop
  if (p.toLowerCase().startsWith("desktop/") || p.toLowerCase().startsWith("desktop\\")) {
    const rel = p.replace(/^desktop[\\/]/i, "")
    return `${DESKTOP_FALLBACK}\\${rel}`
  }
  if (p.toLowerCase() === "desktop") return DESKTOP_FALLBACK
  // just filename -> Desktop
  if (!p.includes("/") && !p.includes("\\")) return `${DESKTOP_FALLBACK}\\${p}`
  // relative -> try to keep as is but join with Desktop if needed
  return p
}

// Tool executor - agent tool cagrisini gercekten calistirir (Node tarafi)
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "read_file": {
      const fs = await import("node:fs/promises")
      const p = resolveNodePath(args.path as string)
      const content = await fs.readFile(p, "utf-8")
      const offset = (args.offset as number) || 1
      const limit = (args.limit as number) || 200
      const lines = content.split("\n")
      const start = Math.max(0, offset - 1)
      const sliced = lines.slice(start, start + limit)
      const numbered = sliced.map((l, i) => `${String(start + i + 1).padStart(4, " ")}: ${l}`).join("\n")
      const header = `File: ${p} (${lines.length} lines, showing ${start + 1}-${start + sliced.length})\n${"─".repeat(50)}\n`
      return header + numbered
    }
    case "write_file": {
      const fs = await import("node:fs/promises")
      const pathMod = await import("node:path")
      const p = resolveNodePath(args.path as string)
      await fs.mkdir(pathMod.dirname(p), { recursive: true })
      await fs.writeFile(p, (args.content as string) ?? "", "utf-8")
      return `✅ Written to ${p} (${(args.content as string)?.length ?? 0} bytes)`
    }
    case "edit_file": {
      const fs = await import("node:fs/promises")
      const p = resolveNodePath(args.path as string)
      const oldStr = args.old_string as string
      const newStr = args.new_string as string
      if (!oldStr) throw new Error("old_string gerekli")
      const content = await fs.readFile(p, "utf-8")
      if (!content.includes(oldStr)) throw new Error(`old_string bulunamadı: "${oldStr.slice(0,80)}..."`)
      const newContent = content.replace(oldStr, newStr)
      await fs.writeFile(p, newContent, "utf-8")
      return `✅ Edited ${p}: "${oldStr.slice(0,40)}..." -> "${newStr.slice(0,40)}..."`
    }
    case "delete_file": {
      const fs = await import("node:fs/promises")
      const p = resolveNodePath(args.path as string)
      const stat = await fs.stat(p)
      if (stat.isDirectory()) await fs.rmdir(p)
      else await fs.unlink(p)
      return `✅ Deleted ${p}`
    }
    case "create_directory": {
      const fs = await import("node:fs/promises")
      const p = resolveNodePath(args.path as string)
      await fs.mkdir(p, { recursive: true })
      return `✅ Created directory ${p}`
    }
    case "search_files": {
      const fs = await import("node:fs/promises")
      const pathMod = await import("node:path")
      const pattern = args.pattern as string
      if (!pattern) throw new Error("pattern gerekli")
      const searchPath = resolveNodePath((args.path as string) || DESKTOP_FALLBACK)
      const include = args.include as string | undefined
      const regex = new RegExp(pattern, "i")
      const results: string[] = []
      async function walk(dir: string, depth = 0) {
        if (depth > 3 || results.length >= 30) return
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          if (results.length >= 30) break
          if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".git") continue
          if (include && !e.name.match(new RegExp(include.replace("*", ".*")))) {
            if (e.isDirectory()) await walk(pathMod.join(dir, e.name), depth + 1)
            continue
          }
          const full = pathMod.join(dir, e.name)
          if (e.isDirectory()) {
            await walk(full, depth + 1)
          } else {
            try {
              const content = await fs.readFile(full, "utf-8")
              const lines = content.split("\n")
              lines.forEach((line, idx) => {
                if (regex.test(line) && results.length < 30) {
                  results.push(`${full}:${idx + 1}: ${line.trim().slice(0,120)}`)
                }
              })
            } catch {}
          }
        }
      }
      await walk(searchPath)
      if (results.length === 0) return `No matches for "${pattern}" in ${searchPath}`
      return `Found ${results.length} matches for "${pattern}":\n` + results.join("\n")
    }
    case "move_file": {
      const fs = await import("node:fs/promises")
      const pathMod = await import("node:path")
      const src = resolveNodePath(args.source as string)
      const dest = resolveNodePath(args.destination as string)
      await fs.mkdir(pathMod.dirname(dest), { recursive: true })
      await fs.rename(src, dest)
      return `✅ Moved ${src} -> ${dest}`
    }
    case "list_files": {
      const fs = await import("node:fs/promises")
      const p = resolveNodePath((args.path as string) || DESKTOP_FALLBACK)
      const files = await fs.readdir(p)
      return files.join("\n") || "(empty directory)"
    }
    case "run_python": {
      const { spawn } = await import("node:child_process")
      const fsSync = await import("node:fs") as any
      const candidates = [
        "C:\\Users\\excalibur\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
        "python",
        "python3",
      ]
      let pyCmd = candidates.find((p) => {
        if (p.includes(":")) try { return fsSync.existsSync(p) } catch { return false }
        return true
      }) || "python"
      // pygame oto-kur helper
      const tryRun = (code: string, cmd: string) => new Promise<string>((resolve, reject) => {
        const proc = spawn(cmd, ["-c", code], { windowsHide: true } as any)
        let out = ""
        let err = ""
        proc.stdout.on("data", (d) => (out += d))
        proc.stderr.on("data", (d) => (err += d))
        proc.on("close", (code) => {
          if (code === 0) resolve(out || "Done (no output)")
          else reject(new Error(err || `Exit ${code}`))
        })
        proc.on("error", (e) => reject(e))
      })
      try {
        return await tryRun(args.code as string, pyCmd)
      } catch (e: any) {
        const msg = String(e.message || "")
        if (msg.includes("No module named 'pygame'") || msg.includes('ModuleNotFoundError')) {
          // Oto kur pygame
          try {
            const pipProc = spawn(pyCmd, ["-m", "pip", "install", "pygame", "--quiet"], { windowsHide: true } as any)
            await new Promise((res) => {
              pipProc.on("close", () => res(null))
              pipProc.on("error", () => res(null))
              setTimeout(() => res(null), 30000)
            })
            // retry
            return await tryRun(args.code as string, pyCmd)
          } catch {}
        }
        throw e
      }
    }
    case "run_javascript": {
      const { spawn } = await import("node:child_process")
      return new Promise((resolve, reject) => {
        const proc = spawn("node", ["-e", args.code as string])
        let out = ""
        let err = ""
        proc.stdout.on("data", (d) => (out += d))
        proc.stderr.on("data", (d) => (err += d))
        proc.on("close", (code) => {
          if (code === 0) resolve(out || "Done (no output)")
          else resolve(`ERR (exit ${code}): ${err || out}`)
        })
        proc.on("error", (e) => reject(e))
      })
    }
    case "run_bash": {
      const { exec } = await import("node:child_process")
      const { promisify } = await import("node:util")
      const execAsync = promisify(exec)

      const command = String(args.command ?? "")
      const requestedTimeout = Number(args.timeout_ms ?? 120000)

      const timeout = Math.min(
        Math.max(
          Number.isFinite(requestedTimeout) ? requestedTimeout : 120000,
          1000
        ),
        600000
      )

      if (!command.trim()) {
        return [
          "Exit Code: 1",
          "Timed Out: false",
          "STDOUT:",
          "",
          "STDERR:",
          "Command is required.",
        ].join("\n")
      }

      try {
        const { stdout, stderr } = await execAsync(command, {
          encoding: "utf8",
          timeout,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
        } as any)

        return [
          "Exit Code: 0",
          "Timed Out: false",
          "STDOUT:",
          String(stdout ?? "").trimEnd(),
          "STDERR:",
          String(stderr ?? "").trimEnd(),
        ].join("\n")
      } catch (error: any) {
        const timedOut = Boolean(
          error?.killed ||
          error?.signal === "SIGTERM"
        )

        const exitCode =
          typeof error?.code === "number"
            ? error.code
            : timedOut
              ? 124
              : 1

        return [
          `Exit Code: ${exitCode}`,
          `Timed Out: ${timedOut}`,
          "STDOUT:",
          String(error?.stdout ?? "").trimEnd(),
          "STDERR:",
          String(
            error?.stderr ??
            error?.message ??
            error
          ).trimEnd(),
        ].join("\n")
      }
    }
    case "run_sandbox": {
      const { runInSandbox } = await import("./sandbox")
      const r = await runInSandbox({ filename: args.filename as string, language: args.language as "python" | "javascript" | "typescript" | "bun", content: args.content as string })
      return r.ok ? `✅ Sandbox OK (${r.duration}ms):\n${r.output.slice(0,3000)}` : `❌ Sandbox FAIL (${r.duration}ms):\nERR: ${r.error.slice(0,2000)}\nOUT: ${r.output.slice(0,1000)}`
    }
    case "web_search": {
      try {
        const q = args.query as string
        // Önce yerel server varsa onu dene (web-ui üzerinden), yoksa doğrudan DuckDuckGo
        try {
          const r = await fetch("http://127.0.0.1:5173/api/web-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
          })
          if (r.ok) {
            const j = await r.json() as { ok: boolean; results: { title: string; url: string; snippet: string }[]; error?: string }
            if (j.ok && j.results.length > 0) {
              return `Web search results for "${q}":\n` + j.results.map((x, i) => `${i + 1}. ${x.title}\n   ${x.url}\n   ${x.snippet}`).join("\n\n")
            }
          }
        } catch {}
        // Fallback: doğrudan DuckDuckGo HTML
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
        const r = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } })
        const html = await r.text()
        const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
        const links = [...html.matchAll(linkRegex)].slice(0, 5).map((m) => ({ url: m[1].replace(/&amp;/g, "&"), title: m[2].replace(/<[^>]+>/g, "").trim() }))
        const snippets = [...html.matchAll(snippetRegex)].slice(0, 5).map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim())
        if (links.length > 0) {
          return `Web search results for "${q}":\n` + links.map((x, i) => `${i + 1}. ${x.title}\n   ${x.url}\n   ${snippets[i] || ""}`).join("\n\n")
        }
        return `Web search for "${q}" - sonuç bulunamadı, model bilgisiyle cevap ver`
      } catch (e) {
        return `Web search error for "${args.query}": ${(e as Error).message} - model bilgisiyle devam et`
      }
    }
    case "fetch_url": {
      try {
        const url = args.url as string
        if (!url.startsWith("http")) throw new Error("URL http ile başlamalı")
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Qwen35-Agent" } })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const text = await r.text()
        // HTML ise text'e çevir
        const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        return `Fetched ${url} (${text.length} chars):\n` + stripped.slice(0, 8000)
      } catch (e) {
        return `Fetch error for ${args.url}: ${(e as Error).message}`
      }
    }
    case "get_system_info": {
      const os = await import("node:os")
      const fs = await import("node:fs/promises")
      const pathMod = await import("node:path")
      try {
        const cwd = process.cwd()
        const desktopFiles = await fs.readdir(DESKTOP_FALLBACK).catch(() => [])
        const ollamaTags = await fetch("http://127.0.0.1:11434/api/tags").then(r=>r.json()).then(j=> (j.models||[]).map((m:{name:string})=>m.name).join(", ")).catch(()=>"Ollama yok")
        return `System Info:
- OS: ${os.platform()} ${os.arch()} | CPU: ${os.cpus()[0]?.model} | RAM: ${(os.totalmem()/1024/1024/1024).toFixed(1)}GB
- CWD: ${cwd}
- Desktop: ${desktopFiles.slice(0,15).join(", ")} (${desktopFiles.length} files)
- Ollama models: ${ollamaTags}
- Node: ${process.version} | Uptime: ${(process.uptime()/60).toFixed(1)}m`
      } catch (e) {
        return `System info error: ${(e as Error).message}`
      }
    }

    case "book_create":
    case "book_status":
    case "book_add_chapter":
    case "book_write":
    case "book_generate":
    case "book_extend":
      return executeBookTool(name, args)

    case "generate_image":
      return executeImageTool(name, args)

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
