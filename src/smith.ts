/**
 * Qwen35-Agent Smith Modu - Tam Otonom Agent (opencode Smith klonu)
 * 3 Faz: Context -> Action -> Verify
 * - Skills, Memory, Learning, Hooks, Sandbox, Retry
 */

import { Qwen35Agent, defaultTools } from "./agent"
import { selectSkills, getToolsForSkills } from "./skills"
import { loadMemory, rememberFile, rememberError, rememberTask, getContextForPrompt } from "./memory"
import { learnFromError, learnFromSuccess, findFixForError } from "./learning"
import { runHooks } from "./hooks"
import { runInSandbox } from "./sandbox"
import { executeTool } from "./tools"

export interface SmithOptions {
  model?: string
  baseUrl?: string
  maxRetries?: number // hata düzeltme denemesi
  useSandbox?: boolean // kum havuzu kullansın mı
  useMemory?: boolean
}

export class SmithAgent {
  private agent: Qwen35Agent
  private maxRetries: number
  private useSandbox: boolean
  private useMemory: boolean

  constructor(opts: SmithOptions = {}) {
    this.agent = new Qwen35Agent({ model: opts.model ?? "qwen35-agent", baseUrl: opts.baseUrl })
    this.maxRetries = opts.maxRetries ?? 3
    this.useSandbox = opts.useSandbox ?? true
    this.useMemory = opts.useMemory ?? true
  }

  /**
   * 3 Fazlı Smith Akışı
   */
  async run(task: string, onProgress?: (phase: string, msg: string) => void): Promise<{ response: string; thinking?: string; iterations: number; toolsUsed: string[] }> {
    const start = Date.now()
    const skills = selectSkills(task)
    const context = this.useMemory ? await getContextForPrompt() : ""
    onProgress?.("context", `Yetenekler: ${skills.map(s=>s.name).join(", ")} | ${context}`)

    // Faz 1: Context toplama
    await runHooks("pre_read", { task })
    const memory = this.useMemory ? await loadMemory() : null
    onProgress?.("context", `Hafıza yüklendi: ${memory?.project.lastFiles.length ?? 0} dosya`)

    // Faz 2: Action - tool loop
    let messages: { role: string; content: string; tool_calls?: unknown; images?: string[] }[] = [
      { role: "user", content: `${task}\n\n[Smith Context: ${context}]` },
    ]
    const tools = defaultTools.filter(t => getToolsForSkills(skills).includes(t.function.name) || t.function.name === "write_file" || t.function.name === "read_file")
    // Her zaman en az 6 temel tool'u ekle
    const finalTools = tools.length ? tools : defaultTools

    let iterations = 0
    let toolsUsed: string[] = []
    let lastResponse = ""
    let lastThinking: string | undefined

    for (let iter = 0; iter < 5; iter++) {
      iterations = iter + 1
      onProgress?.("action", `Iter ${iter + 1}: model çağrılıyor...`)
      const result = await this.agent.chat({
        messages: messages as never,
        tools: finalTools as never,
        think: task.toLowerCase().includes("think") || skills.some(s=>s.name==="debug" || s.name==="code"),
      })

      lastResponse = result.response
      lastThinking = result.thinking
      const toolCalls = (result.toolCalls as unknown as { function: { name: string; arguments: Record<string, unknown> } }[] ) || []

      if (toolCalls.length === 0) {
        onProgress?.("verify", "Tool yok, doğrulama yapılıyor...")
        // Verify: kum havuzunda test et eğer kod dosyası yazıldıysa
        if (this.useSandbox && lastResponse.includes("```")) {
          onProgress?.("verify", "Kod bulundu, kum havuzunda test ediliyor...")
          // Basit: son yazılan dosyayı bul ve test et
          const mem = await loadMemory().catch(()=>null)
          const lastFile = mem?.project.lastFiles[0]?.path
          if (lastFile) {
            try {
              const res = await runInSandbox({ filename: lastFile })
              onProgress?.("verify", `Kum havuzu: ${res.ok ? "başarılı" : "hatalı"} (${res.duration}ms)`)
              if (!res.ok && this.maxRetries > 0) {
                // Retry: hatayı öğren ve düzelt
                await learnFromError(res.error, "Kum havuzu hatası")
                const fix = await findFixForError(res.error)
                onProgress?.("action", `Hata düzeltme deneniyor: ${fix}`)
                messages.push({ role: "assistant", content: lastResponse } as never)
                messages.push({ role: "tool", content: `Kum havuzu hatası: ${res.error}\nÖneri: ${fix}` } as never)
                continue
              }
            } catch {}
          }
        }
        break
      }

      // Tool var
      onProgress?.("action", `${toolCalls.length} tool çalıştırılıyor: ${toolCalls.map(t=>t.function.name).join(", ")}`)
      for (const tc of toolCalls) {
        toolsUsed.push(tc.function.name)
        await runHooks("pre_write", { path: (tc.function.arguments as Record<string,string>).path, tool: tc.function.name })
        let resultStr: string
        try {
          // Sandbox kullanılacak mı?
          if (this.useSandbox && (tc.function.name === "run_python" || tc.function.name === "run_javascript")) {
            const code = (tc.function.arguments as Record<string,string>).code
            const ext = tc.function.name === "run_python" ? "test.py" : "test.js"
            const lang = tc.function.name === "run_python" ? "python" : "javascript"
            const sb = await runInSandbox({ filename: ext, content: code, language: lang as never })
            resultStr = sb.ok ? sb.output : `ERR: ${sb.error} (exit ${sb.exitCode})`
          } else {
            resultStr = await executeTool(tc.function.name, tc.function.arguments as Record<string, unknown>)
          }
          if (tc.function.name.includes("file") || tc.function.name.includes("write")) {
            const p = (tc.function.arguments as Record<string,string>).path
            if (p) await rememberFile(p.includes(":") ? p : `A:\\AI\\qwen35-agent-test-workspace\\${p}`)
          }
          await runHooks("post_write", { path: (tc.function.arguments as Record<string,string>).path, tool: tc.function.name })
          await learnFromSuccess(`${tc.function.name} başarılı`, tc.function.name)
        } catch (e) {
          resultStr = `❌ Hata: ${(e as Error).message}`
          await runHooks("on_error", { error: (e as Error).message, tool: tc.function.name })
          const fix = await findFixForError((e as Error).message)
          if (fix && this.maxRetries > 0) {
            resultStr += `\nÖneri: ${fix}`
            await learnFromError((e as Error).message, fix, tc.function.name)
          }
          await rememberError((e as Error).message, resultStr)
        }
        messages.push({ role: "assistant", content: "", tool_calls: [tc] } as never)
        messages.push({ role: "tool", content: resultStr } as never)
      }
      // Retry için devam
    }

    const duration = Date.now() - start
    await rememberTask(true, lastResponse.length / 4, duration)
    await runHooks("on_success", { response: lastResponse, duration })

    return { response: lastResponse, thinking: lastThinking, iterations, toolsUsed: [...new Set(toolsUsed)] }
  }

  /**
   * Basit chat - Smith olmadan
   */
  async chat(prompt: string): Promise<string> {
    const r = await this.agent.chat({ messages: [{ role: "user", content: prompt }] })
    return r.response
  }
}

export * as SmithAgentNS from "./smith"
