#!/usr/bin/env bun
/**
 * Qwen35-Agent CLI
 * 
 * Kullanım:
 *   bun run src/cli.ts "Merhaba"
 *   bun run src/cli.ts --think "zor matematik sorusu"
 *   bun run src/cli.ts --vision image.png "bu resimde ne var?"
 *   bun run src/cli.ts --code "bir todo app yap"
 *   bun run src/cli.ts --math "x^2 + 5x + 6 = 0 denklemini çöz"
 *   bun run src/cli.ts --model qwen3.5:9b --base-url http://127.0.0.1:11434 "test"
 */

import { Qwen35Agent } from "./agent"
import { SmithAgent } from "./smith"

const args = process.argv.slice(2)

async function main() {
  // Model ve base URL varsayılanları (parametrelerden önce ayarla)
  let selectedModel: string | undefined = undefined
  let selectedBaseUrl: string | undefined = undefined
  
  // Flag parsing - Model ve base-url parametrelerini öncelikle parse et
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--model") {
      if (++i >= args.length) {
        console.error("Hata: --model için değer gerekli!")
        process.exit(1)
      }
      selectedModel = args[i]
    } else if (a === "--base-url") {
      if (++i >= args.length) {
        console.error("Hata: --base-url için değer gerekli!")
        process.exit(1)
      }
      selectedBaseUrl = args[i]
    }
  }
  
  // Model ve base-url varsayılanları ayarla (parametrelerden sonra)
  const model = selectedModel ?? process.env.QWEN_AGENT_MODEL ?? "qwen35-agent:latest"
  const baseUrl = selectedBaseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"

  // 使用實際選取的模型與 Ollama API 位址建立 Agent
  const agent = new Qwen35Agent({
    model,
    baseUrl,
  })

  const smith = new SmithAgent({
    model,
    baseUrl,
  })

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Qwen35-Agent - Qwen3.5:9b Özelleştirilmiş Agent (Smith Otonom Modlu)

Kullanım:
  bun run src/cli.ts [seçenek] "prompt"

Seçenekler:
  --think              Thinking modunu aç (zor sorular için)
  --no-think           Thinking kapalı (hızlı cevap)
  --smith              Smith otonom mod (3-faz, kum havuzu, retry, memory)
  --vision <image>     Görsel analizi (örn: --vision ./photo.jpg "ne var?")
  --code               Kod yazma modu
  --math               Matematik çözüm modu
  --ctx <number>       Context boyutu (varsayılan 32768, max 262144)
  --info               Model bilgisi
  --test               Hızlı test
  --model <name>       Ollama 模型名稱（預設：qwen35-agent:latest）
  --base-url <url>     Ollama API 位址（預設：http://127.0.0.1:11434）

Örnekler:
  bun run src/cli.ts "Merhaba nasılsın?"
  bun run src/cli.ts --smith "Masaüstüne todo app yap ve test et"
  bun run src/cli.ts --think "Bir çiftlikte 17 koyun var, 9'u hariç hepsi öldü kaç kaldı?"
  bun run src/cli.ts --vision ./screenshot.png "bu hatayı açıkla"
  bun run src/cli.ts --code "Python ile hızlı sıralama yaz"
  bun run src/cli.ts --math "3x + 2y = 12, 5x - y = 7 denklemini çöz"

Özellikler: vision, thinking, 256K context, 15 tools, smith otonom, kum havuzu, 201 dil
    `)
    process.exit(0)
  }

  if (args.includes("--info")) {
    console.log("Qwen35-Agent Info:", agent.info)
    const res = await fetch(`${baseUrl}/api/tags`).then((r) => r.json()).catch(() => null)
    console.log("Ollama modeller:", res ? (res as { models: { name: string }[] }).models.map((m) => m.name) : "bağlantı yok")
    process.exit(0)
  }

  if (args.includes("--test")) {
    console.log("🧪 Test başlıyor...")
    const tests = [
      { name: "Basit selam", prompt: "Merhaba! 2 cümlede kendini tanıt" },
      { name: "Kod", prompt: "Python ile faktöriyel fonksiyonu yaz", opts: { think: false } },
    ]
    for (const t of tests) {
      console.log(`\n--- ${t.name} ---`)
      const r = await agent.chat({ messages: [{ role: "user", content: t.prompt }], think: (t.opts as { think?: boolean })?.think })
      console.log(r.response.slice(0, 400))
      if (r.thinking) console.log(`[thinking: ${r.thinking.slice(0, 200)}...]`)
    }
    process.exit(0)
  }

  // Flag parsing - Diğer flag'leri parse et
  let prompt = ""
  let think: boolean | undefined = undefined
  let mode: "chat" | "code" | "math" | "vision" = "chat"
  let imagePath: string | undefined = undefined
  let numCtx: number | undefined = undefined
  let smithMode = false

  const promptParts: string[] = []

  for (let i = 0; i < args.length; i++) {
    const a = args[i]

    if (a === "--model" || a === "--base-url") {
      i++
      continue
    }

    if (a === "--think") {
      think = true
      continue
    }

    if (a === "--no-think") {
      think = false
      continue
    }

    if (a === "--smith") {
      smithMode = true
      continue
    }

    if (a === "--code") {
      mode = "code"
      continue
    }

    if (a === "--math") {
      mode = "math"
      continue
    }

    if (a === "--vision") {
      mode = "vision"

      const value = args[++i]
      if (!value || value.startsWith("--")) {
        console.error("錯誤：--vision 缺少圖片路徑。")
        process.exit(2)
      }

      imagePath = value
      continue
    }

    if (a === "--ctx") {
      const value = args[++i]

      if (!value || value.startsWith("--")) {
        console.error("錯誤：--ctx 缺少數值。")
        process.exit(2)
      }

      numCtx = Number.parseInt(value, 10)

      if (!Number.isInteger(numCtx) || numCtx <= 0) {
        console.error(`錯誤：無效的 --ctx 數值：${value}`)
        process.exit(2)
      }

      continue
    }

    if (
      a === "--help" ||
      a === "-h" ||
      a === "--info" ||
      a === "--test" ||
      a === "--trace-tools"
    ) {
      continue
    }

    if (a.startsWith("--")) {
      console.error(`錯誤：未知選項 ${a}`)
      process.exit(2)
    }

    promptParts.push(a)
  }

  prompt = promptParts.join(" ").trim()

  if (!prompt) {
    console.error("Prompt gerekli! --help ile bak")
    process.exit(1)
  }


  // Smith modu - tam otonom
  if (smithMode) {
    console.log(`\n🤖 Smith Otonom Mod (3-faz: Context → Action → Verify)`)
    console.log(`📝 Görev: ${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}\n`)
    const start = Date.now()
    const smithResult = await smith.run(prompt, (phase, msg) => {
      const icons: Record<string, string> = { context: "🔍", action: "⚙️", verify: "✅" }
      console.log(`${icons[phase] || "•"} [${phase}] ${msg}`)
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    if (smithResult.thinking) {
      console.log("\n💭 Thinking:")
      console.log(smithResult.thinking.slice(0, 1000))
      console.log("\n---\n")
    }
    console.log("💬 Smith Cevap:")
    console.log(smithResult.response)
    console.log(`\n⏱️  Süre: ${elapsed}s | Iter: ${smithResult.iterations} | Tools: ${smithResult.toolsUsed.join(", ") || "yok"}`)
    return
  }

  console.log(`\n🤖 Qwen35-Agent`)
  console.log(`🧠 Model: ${model}`)
  console.log(`🌐 Base URL: ${baseUrl}`)
  console.log(`⚙️ Mode: ${mode}`)
  console.log(`💭 Thinking: ${think ? "ON" : "OFF"}`)
  console.log(`📝 Prompt: ${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}\n`)

  const start = Date.now()
  let result

  if (mode === "vision" && imagePath) {
    result = await agent.vision(imagePath, prompt)
  } else if (mode === "code") {
    result = await agent.chatWithTools({
      messages: [
        {
          role: "system",
          content: [
            "你是執行導向的軟體開發 Agent。",
            "預設使用繁體中文回應，程式碼、命令、識別字及錯誤訊息保留原文。",
            "當任務涉及實際專案或檔案時，必須使用工具完成，不得只提供範例程式碼。",
            "先使用 read_file、list_files 或 search_files 了解現況，再進行修改。",
            "修改後必須使用 run_bash 或 run_sandbox 執行編譯、測試或驗證。",
            "若 Exit Code 非 0，必須讀取 STDOUT 與 STDERR，修正後重新測試。",
            "只有最後一次驗證的 Exit Code 為 0，且要求的結果已實際存在，才能宣告完成。",
            "不得偽造工具輸出，不得將尚未驗證的結果宣告為成功。",
            "處理 .NET 專案時，必須優先找出明確的 solution 或 csproj 路徑。",
            "dotnet build 應直接傳入 solution 或 csproj 完整路徑，不得依賴目前工作目錄。",
            "執行可執行專案時，必須使用 dotnet run --project <csproj> --no-build。",
            "只有確認存在測試專案時才能執行 dotnet test。",
            "測試專案判斷依據包括 Microsoft.NET.Test.Sdk、IsTestProject=true、xunit、NUnit 或 MSTest。",
            "dotnet test Exit Code 0 不代表一定執行了測試，必須確認實際測試數大於 0。",
            "若不存在測試專案，測試狀態必須回報 NO_TEST_PROJECT，這是中性結果，不是失敗。",
            "當任務要求 Build 與 Run 驗證時，即使 Test 為 NO_TEST_PROJECT，只要 Build 與 Run 的所有必要閘門通過，整體結果仍可為 PASS。",
            "每個驗證命令原則上只執行一次；只有命令失敗且已採取具體修正後，才能重新執行。",
            "不得使用 echo、ERRORLEVEL 或 LASTEXITCODE 製造驗證結果，只採信 run_bash 的結構化回傳。",
          ].join("\n"),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      think: true,
      numCtx,
      maxIterations: 12,
      toolTrace: true,
    })
  } else if (mode === "math") {
    result = await agent.math(prompt)
  } else {
    result = await agent.chatWithTools({
      messages: [{ role: "user", content: prompt }],
      think,
      numCtx,
      maxIterations: 8,
      toolTrace: true,
    })
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  if (result.thinking) {
    console.log("💭 Thinking:")
    console.log(result.thinking.slice(0, 1000))
    console.log("\n---\n")
  }

  console.log("💬 Cevap:")
  console.log(result.response)
  console.log(`\n⏱️  Süre: ${elapsed}s | Tokens: ${result.evalCount ?? "?"}`)
}

main().catch((e) => {
  console.error("Hata:", e.message)
  console.error("Ollama çalışıyor mu? -> ollama serve ve ollama list kontrol et")
  process.exit(1)
})
