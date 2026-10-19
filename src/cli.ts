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
 */

import { Qwen35Agent } from "./agent"
import { SmithAgent } from "./smith"

const args = process.argv.slice(2)

async function main() {
  const agent = new Qwen35Agent({ model: "qwen3.5:9b" })
  const smith = new SmithAgent({ model: "qwen35-agent" })

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
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
    const res = await fetch("http://localhost:11434/api/tags").then((r) => r.json()).catch(() => null)
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

  // Flag parsing
  let prompt = ""
  let think: boolean | undefined = undefined
  let mode: "chat" | "code" | "math" | "vision" = "chat"
  let imagePath: string | undefined = undefined
  let numCtx: number | undefined = undefined
  let smithMode = false

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--think") think = true
    else if (a === "--no-think") think = false
    else if (a === "--smith") smithMode = true
    else if (a === "--code") mode = "code"
    else if (a === "--math") mode = "math"
    else if (a === "--vision") {
      mode = "vision"
      imagePath = args[++i]
    } else if (a === "--ctx") {
      numCtx = parseInt(args[++i], 10)
    } else if (!a.startsWith("--")) {
      prompt = args.slice(i).join(" ")
      break
    }
  }

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

  console.log(`\n🤖 Qwen35-Agent (${think ? "thinking ON" : "thinking OFF"}${mode !== "chat" ? `, mode=${mode}` : ""})`)
  console.log(`📝 Prompt: ${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}\n`)

  const start = Date.now()
  let result

  if (mode === "vision" && imagePath) {
    result = await agent.vision(imagePath, prompt)
  } else if (mode === "code") {
    result = await agent.code(prompt)
  } else if (mode === "math") {
    result = await agent.math(prompt)
  } else {
    result = await agent.chatWithTools({
      messages: [{ role: "user", content: prompt }],
      think,
      numCtx,
      maxIterations: 8,
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
