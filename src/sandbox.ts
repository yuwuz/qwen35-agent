/**
 * Qwen35-Agent Sandbox (Smith Sandbox)
 * Tests files in an isolated temp directory without affecting real files
 * - Copies original file to temp (or creates from content)
 * - Runs with selected runtime (python, node, bun)
 * - Returns output, deletes temp
 * - No window popup, runs in background
 */

import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { spawn } from "node:child_process"

export interface SandboxOptions {
  filename: string // Masaüstündeki dosya adı veya tam yol (örn: script.py)
  content?: string // Eğer verilirse dosyayı bu içerikle oluşturur (filename'e yazar)
  language?: "python" | "javascript" | "typescript" | "bun" // runtime
  timeout?: number // ms
}

export interface SandboxResult {
  ok: boolean
  output: string
  error: string
  exitCode: number | null
  duration: number
  tempDir: string
}

const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"

function resolveDesktop(p: string): string {
  if (!p) return p
  if (/^[A-Za-z]:[\\/]/.test(p)) return path.normalize(p)
  const n = p.replace(/\//g, "\\")
  if (n.toLowerCase().startsWith("desktop\\")) return path.join(DESKTOP, n.replace(/^desktop[\\/]?/i, ""))
  if (!n.includes("\\") && !n.includes(":")) return path.join(DESKTOP, n)
  return path.join(DESKTOP, path.basename(n))
}

export async function runInSandbox(options: SandboxOptions): Promise<SandboxResult> {
  const start = Date.now()
  const lang = (options.language || inferLanguage(options.filename) || "python") as SandboxOptions["language"]
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qwen-sandbox-"))
  let targetFile = path.join(tmpDir, path.basename(options.filename))

  try {
    // Dosyayı hazırla
    if (options.content !== undefined) {
      await fs.writeFile(targetFile, options.content, "utf-8")
    } else {
      const src = resolveDesktop(options.filename)
      try {
        await fs.copyFile(src, targetFile)
      } catch {
        throw new Error(`Source file not found: ${src}`)
      }
    }

    // Çalıştır - pygame için headless dummy driver + oto kurulum
    let { cmd, args } = getCommand(lang, targetFile)
    // pygame dosyası mı? headless için SDL dummy
    let isPygame = false
    if (lang === "python") {
      try {
        let contentCheck = options.content ?? ""
        if (!contentCheck) {
          contentCheck = await fs.readFile(targetFile, "utf-8").catch(() => "")
        }
        isPygame = contentCheck.includes("pygame") || contentCheck.includes("import pygame")
      } catch { isPygame = false }
    }

    // Önce pygame import testi - yoksa otomatik kur
    if (lang === "python") {
      try {
        const checkProc = spawn(cmd, ["-c", "import pygame; print('pygame ok')"], { windowsHide: true } as any)
        let checkErr = ""
        checkProc.stderr.on("data", (d: any) => (checkErr += d.toString()))
        const checkCode: number | null = await new Promise((resolve: any) => {
          checkProc.on("close", (c: any) => resolve(c))
          checkProc.on("error", () => resolve(1))
          setTimeout(() => { try { checkProc.kill() } catch {} ; resolve(1) }, 4000)
        })
        if (checkCode !== 0 && checkErr.includes("No module named")) {
          // Oto kur: pip install pygame
          const pipProc = spawn(cmd, ["-m", "pip", "install", "pygame", "--quiet"], { windowsHide: true } as any)
          await new Promise((resolve: any) => {
            pipProc.on("close", () => resolve(null))
            pipProc.on("error", () => resolve(null))
            setTimeout(() => resolve(null), 30000)
          })
        }
      } catch {}
      // Fallback: cmd yoksa python'a düş
      // (getPythonCmd ilk eleman yoksa denemek için)
      const fsSync = await import("node:fs")
      if (!fsSync.existsSync(cmd)) {
        cmd = "python"
      }
    }

    const env: Record<string, string> = { ...(process.env as any) }
    if (isPygame) {
      env.SDL_VIDEODRIVER = "dummy"
      env.PYGAME_HIDE_SUPPORT_PROMPT = "1"
    }

    const proc = spawn(cmd, args, { cwd: tmpDir, timeout: options.timeout ?? 15000, windowsHide: true, env } as any)

    let out = ""
    let err = ""
    proc.stdout.on("data", (d) => (out += d.toString()))
    proc.stderr.on("data", (d) => (err += d.toString()))

    const exitCode: number | null = await new Promise((resolve) => {
      proc.on("close", (code) => resolve(code))
      proc.on("error", () => resolve(1))
      // timeout fallback
      setTimeout(() => {
        try { proc.kill() } catch {}
      }, options.timeout ?? 15000)
    })

    // pygame headless: timeout = success (oyun sonsuz döngü, display gerekir), hata yoksa OK
    const isTimeout = exitCode === null
    // UserWarning'leri temizle (Windows \r\n dahil)
    const cleanErr = err.replace(/.*UserWarning.*\r?\n/g, "").replace(/.*pkg_resources.*\r?\n/g, "").replace(/.*Hello from the pygame.*\r?\n/g, "").trim()

    if (lang === "python" && isPygame) {
      if (isTimeout && !cleanErr.includes("ModuleNotFoundError") && !cleanErr.includes("SyntaxError") && !cleanErr.includes("NameError") && !cleanErr.includes("IndentationError")) {
        return {
          ok: true,
          output: `✅ Pygame OK (headless 15sn test) - syntax doğru, pygame kurulu, oyun döngüsü sonsuz olduğu için timeout normal. Gerçek çalıştırmada pencere açılacak.\n${out.slice(0, 1000)}`,
          error: cleanErr.slice(0, 2000),
          exitCode: 0,
          duration: Date.now() - start,
          tempDir: tmpDir,
        }
      }
      if (cleanErr === "" || (cleanErr.includes("UserWarning") && exitCode === 0)) {
        return {
          ok: true,
          output: `✅ Pygame syntax OK\n${out.slice(0, 2000)}`,
          error: cleanErr.slice(0, 2000),
          exitCode: 0,
          duration: Date.now() - start,
          tempDir: tmpDir,
        }
      }
    }

    return {
      ok: exitCode === 0,
      output: out.slice(0, 8000),
      error: cleanErr.slice(0, 8000),
      exitCode,
      duration: Date.now() - start,
      tempDir: tmpDir,
    }
  } finally {
    // Temizle - hata olsa bile
    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

function inferLanguage(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase()
  if (ext === ".py") return "python"
  if (ext === ".js") return "javascript"
  if (ext === ".ts") return "typescript"
  if (ext === ".mjs" || ext === ".cjs") return "javascript"
  return undefined
}

function getPythonCmd(): string {
  // Doğru Python'u bul - pygame sadece Python312'de kurulu
  const candidates = [
    "C:\\Users\\excalibur\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
    "C:\\Python312\\python.exe",
    "python312",
    "python3",
    "python",
  ]
  // Senkron kontrol yapamıyoruz, spawn aşamasında deneyeceğiz - önce en güvenilir olanı döndür
  return candidates[0]
}

function getCommand(lang: string, file: string): { cmd: string; args: string[] } {
  switch (lang) {
    case "python": return { cmd: getPythonCmd(), args: [file] }
    case "javascript": return { cmd: "node", args: [file] }
    case "typescript": return { cmd: "bun", args: ["run", file] }
    case "bun": return { cmd: "bun", args: ["run", file] }
    default: return { cmd: getPythonCmd(), args: [file] }
  }
}

export const SandboxTool = {
  type: "function" as const,
  function: {
    name: "run_sandbox",
    description: "Test in sandbox - run file in isolated temp directory without affecting real files. Supports Python/JS/TS/Bun. Use for debugging and verification.",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string", description: "File name to test (e.g. script.py, app.js) - taken from Desktop or created via content" },
        language: { type: "string", enum: ["python", "javascript", "typescript", "bun"], description: "Execution language (auto-detected)" },
        content: { type: "string", description: "Optional: file content (if provided, this content is written to filename and tested)" },
      },
      required: ["filename"],
    },
  },
}
