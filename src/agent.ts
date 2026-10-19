/**
 * Qwen35-Agent - Qwen3.5:9b Customized Agent Core
 * 
 * Unlocks all model capabilities:
 * - 256K Long Context
 * - Vision (multimodal)
 * - Thinking mode (toggleable)
 * - Tool calling
 * - 201 languages + Code + Math
 */

export interface Qwen35Config {
  model?: string
  baseUrl?: string
  think?: boolean
  temperature?: number
  numCtx?: number
  stream?: boolean
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  images?: string[] // base64
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface Tool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export interface GenerateOptions {
  prompt?: string
  messages?: ChatMessage[]
  images?: string[] // base64 images for vision
  think?: boolean // /think vs /no_think
  tools?: Tool[]
  numCtx?: number
  temperature?: number
  format?: "json" | string
  stream?: boolean
  toolTrace?: boolean
  onChunk?: (chunk: { content?: string; thinking?: string; toolCalls?: ToolCall[] }) => void
}

export interface GenerateResult {
  response: string
  thinking?: string
  toolCalls?: ToolCall[]
  done: boolean
  evalCount?: number
  totalDuration?: number
}

// Varsayılan araçlar - CANONICAL (tools.ts ile ayni) - 15 tools
export const defaultTools: Tool[] = [
  { type: "function", function: { name: "write_file", description: "Write content to a file. CRITICAL: If user does NOT specify directory, use ONLY filename like 'hello.txt' - system auto-saves to Desktop A:\\AI\\qwen35-agent-test-workspace\\. Never use other directories unless explicitly told.", parameters: { type: "object", properties: { path: { type: "string", description: "File path - use just filename for Desktop, or full path. No dir = Desktop." }, content: { type: "string", description: "File content to write" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "read_file", description: "Read file content. Supports offset/limit for large files.", parameters: { type: "object", properties: { path: { type: "string", description: "File path to read" }, offset: { type: "number", description: "Start line (1-indexed)" }, limit: { type: "number", description: "Max lines" } }, required: ["path"] } } },
  { type: "function", function: { name: "list_files", description: "List files and directories.", parameters: { type: "object", properties: { path: { type: "string", description: "Directory path" } }, required: ["path"] } } },
  { type: "function", function: { name: "edit_file", description: "Edit a file by replacing exact string. Use read_file first.", parameters: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] } } },
  { type: "function", function: { name: "delete_file", description: "Delete a file or empty directory.", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "create_directory", description: "Create a directory (including parents).", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "search_files", description: "Search text pattern in files (grep).", parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, include: { type: "string" } }, required: ["pattern"] } } },
  { type: "function", function: { name: "move_file", description: "Move or rename a file/directory.", parameters: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" } }, required: ["source", "destination"] } } },
  { type: "function", function: { name: "run_python", description: "Execute Python code.", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } } },
  { type: "function", function: { name: "run_javascript", description: "Execute JavaScript via Node.", parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } } },
  { type: "function", function: { name: "run_bash", description: "Execute bash/shell command. Returns Exit Code, Timed Out, STDOUT, and STDERR.", parameters: { type: "object", properties: { command: { type: "string", description: "Shell command to execute" }, timeout_ms: { type: "number", description: "Optional timeout in milliseconds. Minimum 1000, maximum 600000, default 120000." } }, required: ["command"] } } },
  { type: "function", function: { name: "run_sandbox", description: "Test in sandbox - run file in isolated temp directory without affecting real files. Supports Python/JS/TS/Bun. Use for debugging and verification.", parameters: { type: "object", properties: { filename: { type: "string" }, language: { type: "string", enum: ["python", "javascript", "typescript", "bun"] }, content: { type: "string" } }, required: ["filename"] } } },
  { type: "function", function: { name: "web_search", description: "Search the internet via DuckDuckGo.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "fetch_url", description: "Fetch a URL and return text content.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "get_system_info", description: "Get system info: OS, cwd, Desktop files, Ollama models.", parameters: { type: "object", properties: {}, required: [] } } },
  // ── Kitap Yazma Araçları (6) — "kitap yaz" dediğinde otomatik kullanılır ──
  { type: "function", function: { name: "book_create", description: "CREATE NEW BOOK - Use AUTOMATICALLY when user says 'write book', 'new book', 'write novel', 'write story', '3-page book', 'fantasy book'. Creates a complete book project with professional page layout (A5, margins, page numbers), structure (chapters), and text positioning. If page count is specified (e.g. '3-page'), FILL the sayfaSayisi parameter. Book is stored permanently under Desktop/Kitaplar/ and can be continued in a new chat. IMPORTANT: If user says '3-page pdf' with both length and format, set sayfaSayisi=3 and tur=fantasy, then AUTOMATICALLY write all chapters with book_write and generate PDF with book_generate.", parameters: { type: "object", properties: { baslik: { type: "string", description: "Book title (e.g. 'Whispers of Shadows')" }, yazar: { type: "string", description: "Author name (default: anonymous, optional)" }, tur: { type: "string", description: "Genre: novel, story, fantasy, self-help, history, science, children, poetry, memoir, travel (default: novel)" }, ozet: { type: "string", description: "Book topic/summary (2-3 sentences). AI plans chapters from this." }, bolumSayisi: { type: "number", description: "Number of chapters (default: AI decides by genre, usually 8-12). For short books (3 pages) use 2-3." }, sayfaSayisi: { type: "number", description: "TARGET PAGE COUNT - Fill when user says '3-page', '5-page', '10-page'. E.g. 3 pages = ~900 words. Tool plans chapters/words accordingly." }, dil: { type: "string", description: "Language: tr, en (default: tr)" } }, required: ["baslik"] } } },
  { type: "function", function: { name: "book_status", description: "GET BOOK STATUS - List existing books, current chapter, page count, what's next. Use AUTOMATICALLY for 'continue where I left off' in a new chat. DIRECTORY SUPPORTED: you can pass full directory path instead of title (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari).", parameters: { type: "object", properties: { kitapAdi: { type: "string", description: "Book title, folder name OR full directory path (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari). Empty = list all books" } }, required: [] } } },
  { type: "function", function: { name: "book_add_chapter", description: "ADD CHAPTER - Add a new chapter to the book. DIRECTORY SUPPORTED.", parameters: { type: "object", properties: { kitapAdi: { type: "string", description: "Book title OR full directory path" }, baslik: { type: "string", description: "Chapter title" }, ozet: { type: "string", description: "Chapter summary" } }, required: ["kitapAdi", "baslik"] } } },
  { type: "function", function: { name: "book_write", description: "WRITE BOOK / CONTINUE - Write content to a specific chapter or continue where you left off. DIRECTORY SUPPORTED: you can pass full directory path in a new chat.", parameters: { type: "object", properties: { kitapAdi: { type: "string", description: "Book title OR full directory path" }, bolumId: { type: "string", description: "Chapter ID (empty = next chapter)" }, icerik: { type: "string", description: "Content to write (empty = AI continues automatically)" }, konum: { type: "string", description: "Position: baslangic/start, orta/middle, son/end, devam/continue" } }, required: ["kitapAdi"] } } },
  { type: "function", function: { name: "book_generate", description: "GENERATE BOOK - Combine all chapters with professional page layout. DIRECTORY SUPPORTED.", parameters: { type: "object", properties: { kitapAdi: { type: "string", description: "Book title OR full directory path" }, format: { type: "string", enum: ["html", "pdf", "her-ikisi"], description: "Format" } }, required: ["kitapAdi"] } } },
  { type: "function", function: { name: "book_extend", description: "EXTEND BOOK - Continue an existing book from where you left off, ADD PAGES. Use AUTOMATICALLY when user in a new chat gives a directory and says 'add 2 pages', 'continue where I left off, write 3 more pages'. Full path or title can be used.", parameters: { type: "object", properties: { kitapYolu: { type: "string", description: "Book title OR full directory path (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari)" }, ekSayfa: { type: "number", description: "Number of pages to add (e.g. 2)" }, ekOzellik: { type: "string", description: "Optional extra topic/summary" } }, required: ["kitapYolu", "ekSayfa"] } } },
  // ── Görsel Üretme (1) — "görsel oluştur", "resim yap" dediğinde OTOMATİK kullan ──
  { type: "function", function: { name: "generate_image", description: "🎨 GENERATE IMAGE - Use MANDATORILY when user asks for image generation. Translate the request to a detailed English prompt and generate image via Pollinations.ai. Result is shown as image in message box. Even if request is Turkish, make prompt English, detailed, artistic.", parameters: { type: "object", properties: { prompt: { type: "string", description: "Detailed English image prompt" }, width: { type: "number", description: "Width (default 1024)" }, height: { type: "number", description: "Height (default 1024)" }, negative_prompt: { type: "string", description: "Things to avoid" }, seed: { type: "number", description: "Seed (-1 rastgele)" } }, required: ["prompt"] } } },
]

export class Qwen35Agent {
  private baseUrl: string
  private model: string
  private defaultThink: boolean
  private defaultNumCtx: number
  private defaultTemperature: number

  constructor(config: Qwen35Config = {}) {
    this.baseUrl = config.baseUrl ?? "http://127.0.0.1:11434"
    this.model = config.model ?? "qwen3.5:9b"
    this.defaultThink = config.think ?? false // 9B'de varsayılan kapalı, gerektiğinde aç
    this.defaultNumCtx = config.numCtx ?? 32768 // 32K varsayılan, 256K'ya kadar çıkabilir
    this.defaultTemperature = config.temperature ?? 0.7
  }

  /**
   * Ana chat metodu - tüm özellikleri tek yerden yönetir
   * stream:true ile onChunk callback ile canlı akış destekler
   */
  async chat(options: GenerateOptions): Promise<GenerateResult> {
    const think = options.think ?? this.defaultThink
    const messages = this.buildMessages(options, think)

    const doStream = options.stream ?? false
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: doStream,
      options: {
        num_ctx: options.numCtx ?? this.defaultNumCtx,
        temperature: options.temperature ?? this.defaultTemperature,
      },
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
    }
    if (options.format) {
      body.format = options.format
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ollama chat failed: ${res.status} ${text}`)
    }

    if (!doStream) {
      const data = (await res.json()) as {
        message: { content: string; thinking?: string; tool_calls?: ToolCall[] }
        done: boolean
        eval_count?: number
        total_duration?: number
      }
      return {
        response: data.message.content,
        thinking: data.message.thinking,
        toolCalls: data.message.tool_calls,
        done: data.done,
        evalCount: data.eval_count,
        totalDuration: data.total_duration,
      }
    }

    // === STREAMING ===
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let fullContent = ""
    let fullThinking = ""
    let accToolCalls: ToolCall[] = []
    let lastChunk: { eval_count?: number; total_duration?: number; done?: boolean } = {}

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string; thinking?: string; tool_calls?: ToolCall[] }
            done?: boolean
            eval_count?: number
            total_duration?: number
          }
          lastChunk = chunk
          if (chunk.message?.content) {
            fullContent += chunk.message.content
            options.onChunk?.({ content: chunk.message.content, thinking: undefined, toolCalls: undefined })
          }
          if (chunk.message?.thinking) {
            fullThinking += chunk.message.thinking
            options.onChunk?.({ content: undefined, thinking: chunk.message.thinking, toolCalls: undefined })
          }
          if (chunk.message?.tool_calls) {
            accToolCalls = chunk.message.tool_calls
            options.onChunk?.({ toolCalls: accToolCalls })
          }
        } catch {}
      }
    }
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer) as { message?: { content?: string; thinking?: string; tool_calls?: ToolCall[] }; eval_count?: number; total_duration?: number }
        if (chunk.message?.content) fullContent += chunk.message.content
        if (chunk.message?.thinking) fullThinking += chunk.message.thinking
        if (chunk.message?.tool_calls) accToolCalls = chunk.message.tool_calls
        lastChunk = chunk
      } catch {}
    }

    return {
      response: fullContent,
      thinking: fullThinking || undefined,
      toolCalls: accToolCalls.length ? accToolCalls : undefined,
      done: true,
      evalCount: lastChunk.eval_count,
      totalDuration: lastChunk.total_duration,
    }
  }

  /**
   * Otomatik tool loop - model tool_calls dondugunde otomatik calistirir
   * Ornek: Masaustune dosya olustur -> write_file tool'unu calistirir, sonucu modele geri verir
   */
  async chatWithTools(
    options: GenerateOptions & { maxIterations?: number; executeTool?: (name: string, args: Record<string, unknown>) => Promise<string> }
  ): Promise<GenerateResult & { iterations: number; toolResults: string[] }> {
    const maxIterations = options.maxIterations ?? 5
    let messages = this.buildMessages(options, options.think ?? this.defaultThink)
    const tools = options.tools ?? defaultTools
    const allToolResults: string[] = []
    let lastResult: GenerateResult | null = null

    // Dinamik import - circular dependency onlemek icin
    let executor = options.executeTool
    if (!executor) {
      try {
        const mod = await import("./tools.ts")
        executor = mod.executeTool
      } catch {
        executor = async (name, args) => `Tool ${name} executor not found`
      }
    }

    const doStream = options.stream ?? false
    for (let iter = 0; iter < maxIterations; iter++) {
      const body: Record<string, unknown> = {
        model: this.model,
        messages,
        stream: doStream,
        options: {
          num_ctx: options.numCtx ?? this.defaultNumCtx,
          temperature: options.temperature ?? this.defaultTemperature,
        },
        tools,
      }
      if (options.format) body.format = options.format

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Ollama chat failed: ${res.status} ${await res.text()}`)

      let data: {
        message: { content: string; thinking?: string; tool_calls?: ToolCall[] }
        done: boolean
        eval_count?: number
        total_duration?: number
      }

      if (!doStream) {
        data = (await res.json()) as typeof data
      } else {
        const reader = (res.body as ReadableStream<Uint8Array>).getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let fullContent = ""
        let fullThinking = ""
        let accToolCalls: ToolCall[] = []
        let lastChunk: typeof data | null = null
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line) as typeof data & { message?: { content?: string; thinking?: string; tool_calls?: ToolCall[] } }
              lastChunk = chunk as typeof data
              if (chunk.message?.content) {
                fullContent += chunk.message.content
                options.onChunk?.({ content: chunk.message.content })
              }
              if (chunk.message?.thinking) {
                fullThinking += chunk.message.thinking
                options.onChunk?.({ thinking: chunk.message.thinking })
              }
              if (chunk.message?.tool_calls) {
                accToolCalls = chunk.message.tool_calls
                options.onChunk?.({ toolCalls: accToolCalls })
              }
            } catch {}
          }
        }
        if (buffer.trim()) {
          try {
            const chunk = JSON.parse(buffer) as typeof data & { message?: { content?: string; thinking?: string; tool_calls?: ToolCall[] } }
            if (chunk.message?.content) fullContent += chunk.message.content
            if (chunk.message?.thinking) fullThinking += chunk.message.thinking
            if (chunk.message?.tool_calls) accToolCalls = chunk.message.tool_calls
            lastChunk = chunk as typeof data
          } catch {}
        }
        data = {
          message: { content: fullContent, thinking: fullThinking, tool_calls: accToolCalls },
          done: true,
          eval_count: lastChunk?.eval_count,
          total_duration: lastChunk?.total_duration,
        }
      }

      lastResult = {
        response: data.message.content,
        thinking: data.message.thinking,
        toolCalls: data.message.tool_calls,
        done: data.done,
        evalCount: data.eval_count,
        totalDuration: data.total_duration,
      }

      const toolCalls = data.message.tool_calls ?? []

      if (toolCalls.length === 0) {
        const finalResponse = String(data.message.content ?? "").trim()

        if (finalResponse) {
          return {
            ...lastResult,
            response: finalResponse,
            iterations: iter + 1,
            toolResults: allToolResults,
          }
        }

        const hasFinalResponseRequest = messages.some(
          message =>
            message.role === "user" &&
            message.content.includes("[FINAL_RESPONSE_REQUIRED]")
        )

        if (hasFinalResponseRequest) {
          return {
            ...lastResult,
            response: "工具執行完成，但模型未產生最終回答。",
            iterations: iter + 1,
            toolResults: allToolResults,
          }
        }

        messages = [
          ...messages,
          {
            role: "assistant",
            content: data.message.thinking || "",
          },
          {
            role: "user",
            content: [
              "[FINAL_RESPONSE_REQUIRED]",
              "工具執行階段已結束。",
              "不得重新執行任何工具。",
              "請根據先前工具結果輸出最終回答。",
              "全部要求及驗證成功時回答 PASS。",
              "任一要求未完成或驗證失敗時回答 FAIL，並簡短說明。",
              "必須輸出正式回答，不得只提供思考內容或保持空白。",
            ].join("\n"),
          },
        ]

        continue
      }

      // Tool'lari calistir
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.message.content || "",
        tool_calls: toolCalls,
      }
      messages = [...messages, assistantMsg]

      for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
        const tc = toolCalls[toolIndex]

        let args: Record<string, unknown> =
          tc.function.arguments as Record<string, unknown>

        if (typeof args === "string") {
          try {
            args = JSON.parse(args as string)
          } catch {
            args = {}
          }
        }

        const toolNumber = allToolResults.length + 1
        const toolName = tc.function.name

        if (options.toolTrace) {
          const safeArgs = Object.fromEntries(
            Object.entries(args).map(([key, value]) => {
              const protectedKeys = [
                "content",
                "code",
                "icerik",
                "prompt",
              ]

              if (protectedKeys.includes(key.toLowerCase())) {
                const text = String(value ?? "")
                return [key, `[${text.length} chars]`]
              }

              if (typeof value === "string" && value.length > 500) {
                return [
                  key,
                  `${value.slice(0, 500)}... [truncated, ${value.length} chars]`,
                ]
              }

              return [key, value]
            })
          )

          console.log(`\n🔧 [Tool ${toolNumber}] ${toolName}`)
          console.log(
            `   Arguments: ${JSON.stringify(safeArgs)}`
          )
        }

        let result: string

        try {
          result = String(
            await executor!(toolName, args)
          )
        } catch (error: any) {
          result = [
            `Tool Error: ${toolName}`,
            `Message: ${String(
              error?.message ??
              error
            )}`,
          ].join("\n")
        }

        allToolResults.push(result)

        if (options.toolTrace) {
          const maxResultLength = 2000
          const resultPreview =
            result.length > maxResultLength
              ? `${result.slice(0, maxResultLength)}\n... [truncated, ${result.length} chars total]`
              : result

          const failed =
            result.startsWith("Tool Error:") ||
            result.startsWith("FAIL") ||
            result.includes("❌") ||
            (
              result.includes("Exit Code:") &&
              !result.includes("Exit Code: 0")
            )

          const statusIcon = failed ? "❌" : "✅"

          console.log(
            `${statusIcon} [Tool ${toolNumber}] ${toolName}`
          )
          console.log("   Result:")
          console.log(
            resultPreview
              .split("\n")
              .map(line => `   ${line}`)
              .join("\n")
          )
        }

        messages.push({
          role: "tool",
          content: result,
        })
      }
      // loop -> tekrar model cagir, tool sonuclariyla final cevap al
    }

    return { ...(lastResult as GenerateResult), iterations: maxIterations, toolResults: allToolResults }
  }

  /**
   * Basit generate (tek prompt)
   */
  async generate(prompt: string, opts: Omit<GenerateOptions, "prompt" | "messages"> = {}): Promise<GenerateResult> {
    return this.chat({ ...opts, messages: [{ role: "user", content: prompt }] })
  }

  /**
   * Thinking modunu aç/kapat
   * Qwen3.5:9b'de thinking varsayılan kapalı, matematik/kod için açmak çok fark ediyor
   */
  withThinking(enabled: boolean): Qwen35Agent {
    return new Qwen35Agent({
      baseUrl: this.baseUrl,
      model: this.model,
      think: enabled,
      numCtx: this.defaultNumCtx,
      temperature: this.defaultTemperature,
    })
  }

  /**
   * Vision - görseli analiz et
   * Qwen3.5:9b natively multimodal, aynı ağırlıklarla görsel anlar
   */
  async vision(imagePath: string, question: string): Promise<GenerateResult> {
    const base64 = await this.imageToBase64(imagePath)
    return this.chat({
      messages: [
        {
          role: "user",
          content: question,
          images: [base64],
        },
      ],
    })
  }

  /**
   * Kod uzmanı - kod yazma modu
   */
  async code(prompt: string, language = "typescript"): Promise<GenerateResult> {
    return this.chat({
      messages: [
        {
          role: "system",
          content: `Sen uzman bir ${language} geliştiricisisin. Temiz, açıklamalı, production-ready kod yaz.`,
        },
        { role: "user", content: prompt },
      ],
      think: true, // kod için thinking aç
    })
  }

  /**
   * Matematik - adım adım çözüm
   */
  async math(problem: string): Promise<GenerateResult> {
    return this.chat({
      messages: [
        {
          role: "system",
          content: "Sen matematik uzmanısın. Adım adım çöz, her adımı açıkla ve final cevabı \\boxed{} içinde ver.",
        },
        { role: "user", content: `/think ${problem}` },
      ],
      think: true,
    })
  }

  /**
   * Long context - büyük doküman/kod tabanı analizi
   */
  async longContext(documents: string[], question: string): Promise<GenerateResult> {
    const combined = documents.join("\n\n---\n\n")
    return this.chat({
      messages: [{ role: "user", content: `Dokümanlar:\n${combined}\n\nSoru: ${question}` }],
      numCtx: 131072, // 128K context
    })
  }

  private buildMessages(options: GenerateOptions, think: boolean): ChatMessage[] {
    let messages = options.messages ?? []

    // Tek prompt varsa mesaja çevir
    if (options.prompt && messages.length === 0) {
      messages = [{ role: "user", content: options.prompt }]
    }

    // Think toggle: Qwen3.5'te /think ve /no_think tagleri
    if (think && messages.length > 0) {
      const last = messages[messages.length - 1]
      if (last.role === "user" && !last.content.startsWith("/think")) {
        last.content = `/think ${last.content}`
      }
    } else if (!think && messages.length > 0) {
      const last = messages[messages.length - 1]
      if (last.role === "user" && !last.content.startsWith("/no_think")) {
        // 9B'de varsayılan zaten no_think, eklemeye gerek yok ama explicit istersen
        // last.content = `/no_think ${last.content}`
      }
    }

    // Vision images: son mesaja ekle
    if (options.images && options.images.length > 0 && messages.length > 0) {
      messages[messages.length - 1].images = options.images
    }

    return messages
  }

  private async imageToBase64(path: string): Promise<string> {
    const fs = await import("node:fs/promises")
    const buf = await fs.readFile(path)
    return buf.toString("base64")
  }

  // Model bilgisi
  get info() {
    return {
      model: this.model,
      baseUrl: this.baseUrl,
      think: this.defaultThink,
      numCtx: this.defaultNumCtx,
      features: ["vision", "thinking", "tools", "256K-context", "201-languages", "code", "math"] as const,
    }
  }
}

export * as Qwen35AgentNS from "./agent"
