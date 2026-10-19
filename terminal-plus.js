#!/usr/bin/env node
// Qwen35-Agent Terminal Plus - CLEAN FIX v2.1 (kelimeler ic ice gecmez, hatasiz streaming)
import readline from "node:readline"
import fs from "node:fs"
import path from "node:path"
import { spawn, exec } from "node:child_process"

const MODEL_DEFAULT = "qwen35-agent"
const BASE_URL = "http://127.0.0.1:11434"
const WEB_URL = "http://127.0.0.1:5173"
const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"
const HISTORY_FILE = path.join(DESKTOP, ".qwen35-history.json")
const CONFIG_FILE = path.join(DESKTOP, ".qwen35-config.json")

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", italic: "\x1b[3m", underline: "\x1b[4m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m", gray: "\x1b[90m",
  accent: "\x1b[38;5;99m", accent2: "\x1b[38;5;141m",
}

let config = { model: MODEL_DEFAULT, think: false, stream: true, smith: true, numCtx: 32768, temp: 0.7 }
try { if (fs.existsSync(CONFIG_FILE)) config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) } } catch {}
function saveConfig() { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)) } catch {} }

const TOOLS = [
  {type:"function", function:{name:"write_file", description:"Write content to a file.", parameters:{type:"object", properties:{path:{type:"string"}, content:{type:"string"}}, required:["path","content"]}}},
  {type:"function", function:{name:"read_file", description:"Read file content.", parameters:{type:"object", properties:{path:{type:"string"}, offset:{type:"number"}, limit:{type:"number"}}, required:["path"]}}},
  {type:"function", function:{name:"list_files", description:"List files in directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"edit_file", description:"Edit file by replacing exact string.", parameters:{type:"object", properties:{path:{type:"string"}, old_string:{type:"string"}, new_string:{type:"string"}}, required:["path","old_string","new_string"]}}},
  {type:"function", function:{name:"delete_file", description:"Delete file or empty directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"create_directory", description:"Create directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"search_files", description:"Search text in files (grep).", parameters:{type:"object", properties:{pattern:{type:"string"}, path:{type:"string"}, include:{type:"string"}}, required:["pattern"]}}},
  {type:"function", function:{name:"move_file", description:"Move/rename file.", parameters:{type:"object", properties:{source:{type:"string"}, destination:{type:"string"}}, required:["source","destination"]}}},
  {type:"function", function:{name:"run_python", description:"Execute Python code.", parameters:{type:"object", properties:{code:{type:"string"}}, required:["code"]}}},
  {type:"function", function:{name:"run_javascript", description:"Execute JavaScript via Node.", parameters:{type:"object", properties:{code:{type:"string"}}, required:["code"]}}},
  {type:"function", function:{name:"run_bash", description:"Execute bash/shell command.", parameters:{type:"object", properties:{command:{type:"string"}}, required:["command"]}}},
  {type:"function", function:{name:"run_sandbox", description:"Kum havuzunda izole calistir.", parameters:{type:"object", properties:{filename:{type:"string"}, language:{type:"string", enum:["python","javascript","typescript","bun"]}, content:{type:"string"}}, required:["filename"]}}},
  {type:"function", function:{name:"web_search", description:"Search the internet via DuckDuckGo.", parameters:{type:"object", properties:{query:{type:"string"}}, required:["query"]}}},
  {type:"function", function:{name:"fetch_url", description:"Fetch URL and return text.", parameters:{type:"object", properties:{url:{type:"string"}}, required:["url"]}}},
  {type:"function", function:{name:"get_system_info", description:"Get system info.", parameters:{type:"object", properties:{}, required:[]}}},
]

const MODELS = [
  { id: "qwen35-agent", label: "qwen35-agent ★", desc: "256K • Vision • Thinking • Tools" },
  { id: "qwen3.5:9b", label: "qwen3.5:9b", desc: "256K • Vision • 6.6GB" },
  { id: "qwen2.5-coder:7b", label: "qwen2.5-coder:7b", desc: "32K • Kod Uzmani • 4.7GB" },
  { id: "llama3.1:8b-instruct-q4_K_M", label: "llama3.1:8b", desc: "128K • Genel • 4.9GB" },
  { id: "dolphin-llama3:8b", label: "dolphin-llama3:8b", desc: "8K • Sansursuz • 4.7GB" },
]

// ── Responsive helpers (pencere kucultunce kaymaz) ──
function termW() { return process.stdout.columns || 80 }
function boxW() { return Math.max(32, Math.min(68, termW() - 6)) }
function sep(ch="─") { return ch.repeat(boxW()) }
function estimateTokens(text) { return Math.ceil((text || "").length / 4) }
function drawBox(title, lines, width) {
  const w = width || boxW()
  const top = `  ┌─ ${title} ${"─".repeat(Math.max(0, w - title.length - 4))}┐`
  console.log(c.gray + top.slice(0, termW()-1) + c.reset)
  for (const l of lines) {
    const raw = String(l).replace(/\x1b\[[0-9;]*m/g,"")
    const truncated = raw.length > w-4 ? raw.slice(0,w-7)+"..." : l
    // padEnd gorsel uzunluga gore degil, raw'a gore yap ama renk kodlari sakla
    const pad = w - 2 - raw.slice(0,w-4).length
    console.log(`  │ ${truncated}${" ".repeat(Math.max(0,pad))} │`)
  }
  console.log(c.gray + `  └${"─".repeat(w)}┘` + c.reset)
}
function banner() {
  const w = boxW()
  const inner = w - 2
  console.clear()
  console.log(c.accent + `  ╭${"─".repeat(w)}╮` + c.reset)
  const title = `QWEN35-AGENT • Terminal Plus • Clean Streaming`
  console.log(c.accent + `  │  ` + c.bold + c.white + title.slice(0,inner-4) + c.reset + c.accent + " ".repeat(Math.max(0,inner - title.length -2)) + `  │` + c.reset)
  const sub = `Model: ${config.model} • ${config.think ? "Thinking ACIK" : "KAPALI"} • ${config.stream ? "Stream ACIK":"KAPALI"} • Smith ${config.smith?"ACIK":"KAPALI"}`
  console.log(c.accent + `  │  ` + c.dim + sub.slice(0,inner-4) + c.reset + " ".repeat(Math.max(0,inner - sub.length -2)) + c.accent + `  │` + c.reset)
  console.log(c.accent + `  ╰${"─".repeat(w)}╯` + c.reset)
  console.log(c.gray + `  ${config.model} | ctx:${config.numCtx} temp:${config.temp} | ${TOOLS.length} tools`.slice(0,termW()-2) + c.reset)
  const think = config.think ? c.green + "● ACIK " + c.reset : c.gray + "○ KAPALI" + c.reset
  const stream = config.stream ? c.green + "● ACIK " + c.reset : c.gray + "○ KAPALI" + c.reset
  const smith = config.smith ? c.green + "● ACIK " + c.reset : c.gray + "○ KAPALI" + c.reset
  console.log(c.gray + `  ┌─ Kontroller ${"─".repeat(Math.max(0,w-15))}┐` + c.reset)
  console.log(`  │ Thinking: ${think} │ Stream: ${stream} │ Smith: ${smith} │`.slice(0,termW()-1))
  console.log(c.gray + `  └${"─".repeat(w)}┘` + c.reset)
}
function progressBar(used, total) {
  const pct = Math.min(100, Math.round(used / total * 100))
  const w = boxW()
  const barW = Math.max(10, Math.min(28, w - 28))
  const filled = Math.round(barW * pct / 100)
  const bar = c.accent + "█".repeat(filled) + c.gray + "░".repeat(barW - filled) + c.reset
  const color = pct > 85 ? c.red : pct > 60 ? c.yellow : c.green
  console.log(`  ${color}Context: ${bar} ${pct}%  ${used}/${total}${c.reset}`)
}
function resolvePath(p) {
  if (!p) return p
  if (/^[A-Za-z]:[\\/]/.test(p)) return path.normalize(p)
  const n = p.replace(/\//g, "\\")
  if (n.toLowerCase().startsWith("desktop\\") || n.toLowerCase() === "desktop") {
    const rel = n.replace(/^desktop[\\/]?/i, "")
    return rel ? path.join(DESKTOP, rel) : DESKTOP
  }
  if (!n.includes("\\") && !n.includes(":")) return path.join(DESKTOP, n)
  return path.join(DESKTOP, path.basename(n))
}

// ── Tool executor ──
async function executeTool(name, args) {
  try {
    if (typeof args === "string") { try { args = JSON.parse(args) } catch { args = {} } }
    if (name === "write_file") {
      const full = resolvePath(args.path)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, args.content ?? "", "utf-8")
      return `✅ Written to ${full} (${(args.content || "").length} bytes)`
    }
    if (name === "read_file") {
      const full = resolvePath(args.path)
      const content = fs.readFileSync(full, "utf-8")
      const offset = args.offset || 1
      const limit = args.limit || 80
      const lines = content.split("\n")
      const start = Math.max(0, offset - 1)
      const sliced = lines.slice(start, start + limit)
      return `File: ${full} (${lines.length} lines, showing ${start + 1}-${start + sliced.length})\n${"─".repeat(50)}\n` + sliced.map((l, i) => `${String(start + i + 1).padStart(4, " ")}: ${l}`).join("\n")
    }
    if (name === "list_files") {
      const full = resolvePath(args.path || DESKTOP)
      const files = fs.readdirSync(full).map(f => {
        const fp = path.join(full, f)
        try { const s = fs.statSync(fp); return `${s.isDirectory() ? "DIR " : "FILE "}${f} (${s.size} bytes)` } catch { return f }
      })
      return `Files in ${full}:\n${files.slice(0, 60).join("\n")}`
    }
    if (name === "edit_file") {
      const full = resolvePath(args.path)
      const content = fs.readFileSync(full, "utf-8")
      if (!content.includes(args.old_string)) throw new Error(`old_string bulunamadi`)
      fs.writeFileSync(full, content.replace(args.old_string, args.new_string), "utf-8")
      return `✅ Edited ${full}`
    }
    if (name === "delete_file") {
      const full = resolvePath(args.path)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) fs.rmdirSync(full)
      else fs.unlinkSync(full)
      return `✅ Deleted ${full}`
    }
    if (name === "create_directory") {
      const full = resolvePath(args.path)
      fs.mkdirSync(full, { recursive: true })
      return `✅ Created ${full}`
    }
    if (name === "search_files") {
      const pattern = args.pattern
      const searchPath = resolvePath(args.path || DESKTOP)
      const regex = new RegExp(pattern, "i")
      const results = []
      function walk(dir, depth = 0) {
        if (depth > 3 || results.length >= 30) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          if (results.length >= 30) break
          if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".git") continue
          const full = path.join(dir, e.name)
          if (e.isDirectory()) try { walk(full, depth + 1) } catch {}
          else {
            try {
              const c2 = fs.readFileSync(full, "utf-8")
              c2.split("\n").forEach((line, idx) => {
                if (regex.test(line) && results.length < 30) results.push(`${full}:${idx + 1}: ${line.trim().slice(0, 120)}`)
              })
            } catch {}
          }
        }
      }
      walk(searchPath)
      return results.length ? `Found ${results.length} for "${pattern}":\n` + results.join("\n") : `No matches for "${pattern}"`
    }
    if (name === "move_file") {
      const src = resolvePath(args.source)
      const dest = resolvePath(args.destination)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.renameSync(src, dest)
      return `✅ Moved ${src} -> ${dest}`
    }
    if (name === "run_python") {
      return await new Promise(resolve => {
        const proc = spawn("python", ["-c", args.code], { timeout: 15000 })
        let out = "", err = ""
        proc.stdout.on("data", d => out += d)
        proc.stderr.on("data", d => err += d)
        proc.on("close", code => resolve((out || "") + (err ? "\nERR: " + err : "") + ` (exit ${code})`))
        proc.on("error", e => resolve(`ERR: ${e.message}`))
      })
    }
    if (name === "run_javascript") {
      return await new Promise(resolve => {
        const proc = spawn("node", ["-e", args.code], { timeout: 10000 })
        let out = "", err = ""
        proc.stdout.on("data", d => out += d)
        proc.stderr.on("data", d => err += d)
        proc.on("close", code => resolve((out || "") + (err ? "\nERR: " + err : "") + ` (exit ${code})`))
        proc.on("error", e => resolve(`ERR: ${e.message}`))
      })
    }
    if (name === "run_bash") {
      return await new Promise(resolve => {
        exec(args.command, { timeout: 10000 }, (err, stdout, stderr) => {
          resolve((stdout || "") + (stderr ? "\nERR: " + stderr : "") + (err ? `\nERR:${err.message}` : ""))
        })
      })
    }
    if (name === "run_sandbox") {
      try {
        const r = await fetch("http://127.0.0.1:5173/api/run-sandbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: args.filename, language: args.language, content: args.content }) })
        const j = await r.json()
        return j.ok ? `✅ Sandbox OK:\n${j.output.slice(0, 3000)}` : `❌ Sandbox FAIL:\n${(j.error || "").slice(0, 2000)}`
      } catch (e) { return `Sandbox hata: ${e.message}` }
    }
    if (name === "fetch_url") {
      const r = await fetch(args.url, { headers: { "User-Agent": "Mozilla/5.0 Qwen35-Agent" } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000)
      return `Fetched ${args.url} (${text.length} chars):\n` + stripped
    }
    if (name === "get_system_info") {
      const osMod = await import("node:os")
      let ollamaModels = "yok"
      try { const r = await fetch("http://127.0.0.1:11434/api/tags"); const j = await r.json(); ollamaModels = j.models.map(m => m.name).join(", ") } catch {}
      return `System: ${osMod.platform()} ${osMod.arch()} | ${osMod.cpus()[0]?.model} | RAM ${(osMod.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB\nCWD: ${process.cwd()}\nOllama: ${ollamaModels}`
    }
    if (name === "web_search") {
      try {
        const r = await fetch("http://127.0.0.1:5173/api/web-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: args.query }) })
        if (r.ok) {
          const j = await r.json()
          if (j.ok && j.results.length) return `Web search for "${args.query}":\n` + j.results.map((x, i) => `${i + 1}. ${x.title}\n   ${x.url}\n   ${x.snippet}`).join("\n\n")
        }
      } catch {}
      try {
        const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, { headers: { "User-Agent": "Mozilla/5.0" } })
        const html = await r.text()
        const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
        const links = [...html.matchAll(linkRegex)].slice(0, 3).map(m => m[2].replace(/<[^>]+>/g, "").trim() + " - " + m[1].replace(/&amp;/g, "&"))
        if (links.length) return `Web search for "${args.query}":\n` + links.join("\n")
      } catch (e) { return `Web search error: ${e.message}` }
      return `Web search for "${args.query}" - sonuc yok`
    }
    return `Unknown tool ${name}`
  } catch (e) { return `❌ Tool error ${name}: ${e.message}` }
}

// ── CLEAN STREAMING (hatasiz, ic ice gecmez) ──
async function callOllamaStreaming(messages, options = {}) {
  const body = {
    model: options.model || config.model,
    messages,
    stream: true,
    options: { num_ctx: options.numCtx || config.numCtx, temperature: options.temperature ?? config.temp },
    tools: options.tools || TOOLS,
  }
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = "", fullContent = "", fullThinking = "", toolCalls = [], lastChunk = null

  let thinkingOpen = false
  let thinkingClosed = false
  let contentStarted = false

  // Responsive thinking kutusu (genislik pencereye gore)
  function openThinking() {
    if (!thinkingOpen) {
      thinkingOpen = true
      const w = boxW()
      process.stdout.write(`\n${c.gray}┌─ 💭 Thinking ${"─".repeat(Math.max(0,w-14))}┐${c.reset}\n${c.gray}│ ${c.reset}`)
    }
  }
  function closeThinking() {
    if (thinkingOpen && !thinkingClosed) {
      thinkingClosed = true
      const w = boxW()
      process.stdout.write(`${c.reset}\n${c.gray}└${"─".repeat(w)}┘${c.reset}\n\n`)
    }
  }
  function ensureContent() {
    if (!contentStarted) {
      contentStarted = true
      if (thinkingOpen && !thinkingClosed) closeThinking()
      // content basliyor - ek satir zaten var
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const chunk = JSON.parse(line)
        lastChunk = chunk
        if (chunk.message?.thinking) {
          openThinking()
          fullThinking += chunk.message.thinking
          // newline'leri kutu icinde koru: "\n" -> "\n│ "
          const safe = chunk.message.thinking.replace(/\n/g, `\n${c.gray}│ ${c.reset}${c.gray}`)
          process.stdout.write(c.gray + safe + c.reset)
        }
        if (chunk.message?.content) {
          ensureContent()
          fullContent += chunk.message.content
          process.stdout.write(chunk.message.content)
        }
        if (chunk.message?.tool_calls) toolCalls = chunk.message.tool_calls
      } catch {}
    }
  }
  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer)
      if (chunk.message?.thinking) {
        openThinking()
        fullThinking += chunk.message.thinking
        process.stdout.write(c.gray + chunk.message.thinking + c.reset)
      }
      if (chunk.message?.content) {
        ensureContent()
        fullContent += chunk.message.content
        process.stdout.write(chunk.message.content)
      }
      if (chunk.message?.tool_calls) toolCalls = chunk.message.tool_calls
      lastChunk = chunk
    } catch {}
  }
  // stream bitti - thinking kutusunu kapat (icerik gelmediyse de)
  if (thinkingOpen && !thinkingClosed) closeThinking()
  // content bitiminde yeni satir garantile
  if (contentStarted || thinkingOpen) process.stdout.write("\n")
  return { content: fullContent, thinking: fullThinking, toolCalls, raw: lastChunk }
}

async function imageToBase64(p) {
  const buf = fs.readFileSync(p)
  return buf.toString("base64")
}
function helpText() {
  console.log(`
${c.bold}📚 Komutlar:${c.reset}
  ${c.cyan}/help${c.reset}             Bu yardim
  ${c.cyan}/model${c.reset}            Model sec (1-5 veya isim)
  ${c.cyan}/think${c.reset} / ${c.cyan}/no_think${c.reset}      Thinking ac/kapat
  ${c.cyan}/stream${c.reset}           Streaming ac/kapat
  ${c.cyan}/smith${c.reset}            Smith otonom ac/kapat
  ${c.cyan}/ctx <8K|32K|64K|128K|256K>${c.reset}  Context boyutu
  ${c.cyan}/temp <0-2>${c.reset}       Temperature
  ${c.cyan}/settings${c.reset}         Ayarlari goster
  ${c.cyan}/vision <dosya> [soru]${c.reset}  Gorsel analiz
  ${c.cyan}/code <istek>${c.reset}       Kod modu
  ${c.cyan}/math <problem>${c.reset}     Matematik modu
  ${c.cyan}/clear${c.reset}            Sohbeti temizle
  ${c.cyan}/history${c.reset}          Gecmisi goster
  ${c.cyan}/export${c.reset}           Sohbeti .json disa aktar
  ${c.cyan}/import <dosya>${c.reset}    Sohbeti ice aktar
  ${c.cyan}/new${c.reset}              Yeni sohbet
  ${c.cyan}/tools${c.reset}            Araclari listele
  ${c.cyan}/files [yol]${c.reset}       Dosyalari listele
  ${c.cyan}/write <dosya> <icerik>${c.reset}  Hizli dosya yaz
  ${c.cyan}/read <dosya>${c.reset}       Hizli dosya oku
  ${c.cyan}/ui${c.reset}               Web UI'i ac
  ${c.cyan}/web <soru>${c.reset}         Hizli web arama
  ${c.cyan}/copy${c.reset}             Son kod blogunu panoya kopyala
  ${c.cyan}/exit${c.reset}             Cikis
`)
}
function showSettings() {
  console.log(`\n${c.bold}⚙️  Ayarlar:${c.reset}`)
  drawBox("Ayarlar", [
    `Model:        ${c.cyan}${config.model}${c.reset}  ${MODELS.find(m => m.id === config.model)?.desc || ""}`,
    `Thinking:     ${config.think ? c.green + "ACIK" : c.gray + "KAPALI"}${c.reset}`,
    `Streaming:    ${config.stream ? c.green + "ACIK" : c.gray + "KAPALI"}${c.reset}`,
    `Smith:        ${config.smith ? c.green + "ACIK" : c.gray + "KAPALI"}${c.reset}`,
    `Context:      ${c.yellow}${config.numCtx}${c.reset} token`,
    `Temperature:  ${c.yellow}${config.temp}${c.reset}`,
  ])
}
function showModels() {
  console.log(`\n${c.bold}🧠 Modeller:${c.reset}`)
  MODELS.forEach((m, i) => {
    const active = m.id === config.model ? c.green + " ★ aktif" + c.reset : ""
    console.log(`  ${i + 1}. ${c.cyan}${m.id}${c.reset}  ${c.gray}${m.desc}${c.reset}${active}`)
  })
  console.log(c.gray + `  Secmek icin: /model 2  veya  /model qwen3.5:9b` + c.reset)
}
function showTools() {
  console.log(`\n${c.bold}🔧 Araclar (15):${c.reset}`)
  const groups = [
    ["📁 Dosya (8)", ["write_file", "read_file", "list_files", "edit_file", "delete_file", "create_directory", "search_files", "move_file"]],
    ["💻 Kod (4)", ["run_python", "run_javascript", "run_bash", "run_sandbox"]],
    ["🌐 Web (3)", ["web_search", "fetch_url", "get_system_info"]],
  ]
  for (const [title, names] of groups) {
    console.log(`  ${c.bold}${title}${c.reset}`)
    names.forEach(n => {
      const t = TOOLS.find(x => x.function.name === n)
      console.log(`    ${c.yellow}• ${n.padEnd(18)}${c.reset} ${c.gray}${t.function.description.slice(0, 64)}...${c.reset}`)
    })
  }
}

async function main() {
  banner()
  try {
    const r = await fetch(`${BASE_URL}/api/tags`)
    if (!r.ok) throw new Error()
    console.log(c.green + `\n✅ Ollama bagli • ${BASE_URL}` + c.reset)
    try { const j = await r.json(); console.log(c.gray + `   Modeller: ${j.models.map(m => m.name).join(", ").slice(0, 80)}` + c.reset) } catch {}
  } catch {
    console.log(c.red + `\n❌ Ollama calismiyor! Yeni CMD'de: ollama serve` + c.reset)
    try { console.log(c.yellow + "  Otomatik baslatiliyor..." + c.reset); spawn("ollama", ["serve"], { detached: true, stdio: "ignore" }).unref(); await new Promise(r => setTimeout(r, 2500)) } catch {}
    try { const r = await fetch(`${BASE_URL}/api/tags`); if (r.ok) console.log(c.green + "✅ Baglandi" + c.reset); else throw 0 } catch { console.log(c.red + "  Hala baglanamadi." + c.reset) }
  }
  let history = []
  try { if (fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")) } catch {}
  const saveHistory = () => { try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-80), null, 2)) } catch {} }
  const usedTokens = () => history.reduce((a, m) => a + estimateTokens(m.content) + (m.images ? 600 : 0), 0)

  console.log(c.green + `\n✅ Hazir! ${c.bold}/help${c.reset + c.green} yaz veya mesaj gonder.` + c.reset)
  if (history.length > 0) {
    const u = usedTokens()
    progressBar(u, config.numCtx)
    console.log(c.gray + `  📜 ${history.length} mesaj geri yuklendi • /clear ile sil` + c.reset)
  }
  console.log(c.gray + `  ${sep()}` + c.reset + "\n")

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let lastCodeBlock = ""
  const ask = () => {
    const prefix = config.think ? c.yellow + "[think ON] " + c.reset : c.gray + "[think OFF] " + c.reset
    const ctxInfo = c.dim + `(${usedTokens()}/${config.numCtx})` + c.reset
    rl.question(prefix + c.cyan + "Sen " + ctxInfo + ": " + c.reset, async (input) => {
      const trimmed = input.trim()
      if (!trimmed) return ask()
      if (trimmed === "/help" || trimmed === "/?" || trimmed === "/h") { helpText(); return ask() }
      if (trimmed === "/settings" || trimmed === "/config") { showSettings(); return ask() }
      if (trimmed === "/tools") { showTools(); return ask() }
      if (trimmed === "/exit" || trimmed === "/quit" || trimmed === "/q") {
        console.log(c.gray + "\nGorusuruz! 👋" + c.reset); saveHistory(); rl.close(); process.exit(0)
      }
      if (trimmed === "/clear" || trimmed === "/c") {
        history = []; saveHistory(); console.clear(); banner()
        console.log(c.green + "✅ Temizlendi\n" + c.reset); return ask()
      }
      if (trimmed === "/new") {
        if (history.length > 0) saveHistory()
        history = []; saveHistory(); console.log(c.green + "✅ Yeni sohbet\n" + c.reset); return ask()
      }
      if (trimmed === "/history" || trimmed === "/h") {
        if (history.length === 0) { console.log(c.gray + "  Henuz mesaj yok.\n" + c.reset); return ask() }
        console.log(c.magenta + `\n📜 Gecmis (${history.length} mesaj, ${usedTokens()} token):` + c.reset)
        history.slice(-12).forEach((m, i) => {
          const role = m.role === "user" ? c.cyan + "Sen" + c.reset : m.role === "tool" ? c.yellow + "Tool" + c.reset : c.green + "Agent" + c.reset
          console.log(`  ${String(history.length - 12 + i + 1).padStart(2, " ")}. [${role}] ${m.content.slice(0, 90).replace(/\n/g, " ")}${m.tool_calls ? " 🔧" : ""}`)
        })
        progressBar(usedTokens(), config.numCtx)
        console.log()
        return ask()
      }
      if (trimmed.startsWith("/export")) {
        const out = trimmed.split(" ")[1] || `qwen-chat-${new Date().toISOString().slice(0, 10)}.json`
        const full = resolvePath(out)
        try { fs.writeFileSync(full, JSON.stringify(history, null, 2), "utf-8"); console.log(c.green + `✅ Disa aktarildi: ${full} (${history.length} mesaj)` + c.reset + "\n") } catch (e) { console.log(c.red + `❌ Export hata: ${e.message}` + c.reset + "\n") }
        return ask()
      }
      if (trimmed.startsWith("/import")) {
        const p = trimmed.split(" ").slice(1).join(" ").trim()
        if (!p) { console.log(c.red + "  Kullanim: /import <dosya.json>" + c.reset + "\n"); return ask() }
        try {
          const full = resolvePath(p)
          const data = JSON.parse(fs.readFileSync(full, "utf-8"))
          if (!Array.isArray(data)) throw new Error("Gecersiz format")
          history = data; saveHistory()
          console.log(c.green + `✅ Ice aktarildi: ${full} (${history.length} mesaj)` + c.reset + "\n")
          progressBar(usedTokens(), config.numCtx)
        } catch (e) { console.log(c.red + `❌ Import hata: ${e.message}` + c.reset + "\n") }
        return ask()
      }
      if (trimmed === "/ui" || trimmed === "/webui") {
        console.log(c.cyan + `🌐 Web UI aciliyor: ${WEB_URL}` + c.reset)
        const cmd = process.platform === "win32" ? `start "" "${WEB_URL}"` : process.platform === "darwin" ? `open "${WEB_URL}"` : `xdg-open "${WEB_URL}"`
        exec(cmd, () => {})
        try { const r = await fetch(WEB_URL + "/api/health"); if (!r.ok) throw 0; console.log(c.green + "✅ Web server ayakta." + c.reset) } catch {
          console.log(c.yellow + "  Web server baslatiliyor..." + c.reset)
          spawn("node", [path.join(path.dirname(process.argv[1] || "."), "web-ui", "server.js")], { detached: true, stdio: "ignore" }).unref()
        }
        console.log()
        return ask()
      }
      if (trimmed.startsWith("/copy")) {
        if (!lastCodeBlock) { console.log(c.yellow + "  Kopyalanacak kod blogu yok\n" + c.reset); return ask() }
        try {
          if (process.platform === "win32") {
            const p = spawn("clip", [], { stdio: ["pipe", "ignore", "ignore"] })
            p.stdin.write(lastCodeBlock); p.stdin.end()
            console.log(c.green + "✅ Kod panoya kopyalandi\n" + c.reset)
          } else {
            exec(`echo ${JSON.stringify(lastCodeBlock)} | pbcopy`, () => console.log(c.green + "✅ Kopyalandi\n" + c.reset))
          }
        } catch (e) { console.log(c.gray + lastCodeBlock.slice(0, 400) + c.reset + "\n") }
        return ask()
      }
      if (trimmed.startsWith("/files") || trimmed.startsWith("/list")) {
        const p = trimmed.split(" ").slice(1).join(" ").trim() || DESKTOP
        try {
          const full = resolvePath(p || DESKTOP)
          const files = fs.readdirSync(full).slice(0, 40).map(f => {
            const fp = path.join(full, f)
            try { const s = fs.statSync(fp); return `${s.isDirectory() ? c.cyan + "DIR " + c.reset : "FILE "}${f} ${c.gray}(${s.size} bytes)${c.reset}` } catch { return f }
          })
          drawBox(`📂 ${p || "Desktop"}`, files.slice(0, 20))
        } catch (e) { console.log(c.red + `❌ ${e.message}` + c.reset) }
        console.log()
        return ask()
      }
      if (trimmed.startsWith("/write ")) {
        const m = trimmed.match(/^\/write\s+(\S+)\s+([\s\S]+)/)
        if (!m) { console.log(c.red + "  Kullanim: /write <dosya> <icerik>\n" + c.reset); return ask() }
        const full = resolvePath(m[1]); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, m[2], "utf-8")
        console.log(c.green + `✅ Yazildi: ${full}\n` + c.reset); return ask()
      }
      if (trimmed.startsWith("/read ")) {
        const p = trimmed.slice(6).trim()
        try {
          const full = resolvePath(p)
          const content = fs.readFileSync(full, "utf-8")
          console.log(c.gray + `── ${full} (${content.length} chars) ──` + c.reset)
          console.log(content.slice(0, 6000) + (content.length > 6000 ? c.gray + "\n... (daha fazla var)" + c.reset : ""))
        } catch (e) { console.log(c.red + `❌ ${e.message}` + c.reset) }
        console.log(); return ask()
      }
      if (trimmed.startsWith("/model")) {
        const arg = trimmed.slice(6).trim()
        if (!arg) { showModels(); return ask() }
        let target = arg
        if (/^[1-5]$/.test(arg)) target = MODELS[parseInt(arg) - 1]?.id
        if (!MODELS.find(m => m.id === target)) { console.log(c.red + `❌ Model bulunamadi: ${arg}\n` + c.reset); return ask() }
        config.model = target; saveConfig()
        console.log(c.green + `✅ Model: ${target}\n` + c.reset); return ask()
      }
      if (trimmed === "/think") { config.think = true; saveConfig(); console.log(c.yellow + "💭 Thinking ACIK\n" + c.reset); return ask() }
      if (trimmed === "/no_think" || trimmed === "/nothink") { config.think = false; saveConfig(); console.log(c.gray + "💨 Thinking KAPALI\n" + c.reset); return ask() }
      if (trimmed === "/stream") { config.stream = !config.stream; saveConfig(); console.log(`${config.stream ? c.green + "Streaming ACIK" : c.gray + "Streaming KAPALI"}${c.reset}\n`); return ask() }
      if (trimmed === "/smith") { config.smith = !config.smith; saveConfig(); console.log(`${config.smith ? c.green + "Smith ACIK" : c.gray + "Smith KAPALI"}${c.reset}\n`); return ask() }
      if (trimmed.startsWith("/ctx")) {
        const v = trimmed.split(" ")[1]
        if (!v) { console.log(c.gray + `  Mevcut ctx: ${config.numCtx}\n` + c.reset); return ask() }
        const map = { "8k": 8192, "8K": 8192, "32k": 32768, "32K": 32768, "64k": 65536, "64K": 65536, "128k": 131072, "128K": 131072, "256k": 262144, "256K": 262144 }
        const n = map[v] || parseInt(v, 10)
        if (!n || n < 1024) { console.log(c.red + "  Gecersiz ctx\n" + c.reset); return ask() }
        config.numCtx = n; saveConfig(); console.log(c.green + `✅ Context: ${n}\n` + c.reset); return ask()
      }
      if (trimmed.startsWith("/temp")) {
        const v = parseFloat(trimmed.split(" ")[1])
        if (isNaN(v)) { console.log(c.gray + `  Mevcut temp: ${config.temp}\n` + c.reset); return ask() }
        config.temp = Math.max(0, Math.min(2, v)); saveConfig(); console.log(c.green + `✅ Temperature: ${config.temp}\n` + c.reset); return ask()
      }
      if (trimmed.startsWith("/web ")) {
        const q = trimmed.slice(5).trim()
        console.log(c.yellow + `🌐 Araniyor: ${q} ...` + c.reset)
        const r = await executeTool("web_search", { query: q })
        console.log(r + "\n"); return ask()
      }
      if (trimmed.startsWith("/vision ")) {
        const parts = trimmed.slice(8).trim().split(" ")
        const imgPath = parts[0]
        const q = parts.slice(1).join(" ") || "Bu gorselde ne var? Detayli analiz et."
        if (!fs.existsSync(imgPath) && !fs.existsSync(resolvePath(imgPath))) {
          console.log(c.red + `❌ Dosya bulunamadi: ${imgPath}\n` + c.reset); return ask()
        }
        const real = fs.existsSync(imgPath) ? imgPath : resolvePath(imgPath)
        console.log(c.yellow + `🖼️  Gorsel: ${real} • Soru: ${q}` + c.reset)
        const b64 = await imageToBase64(real)
        history.push({ role: "user", content: q, images: [b64] })
        console.log(c.green + `\n🤖 Agent (${config.model}):` + c.reset)
        console.log(c.gray + sep() + c.reset)
        const start = Date.now()
        try {
          const result = await callOllamaStreaming(history, {})
          console.log(c.gray + `${sep()}` + c.reset)
          history.push({ role: "assistant", content: result.content })
          saveHistory()
          const m = result.content.match(/```[\s\S]*?```/)
          if (m) lastCodeBlock = m[0].replace(/```\w*\n?/, "").replace(/```$/, "")
          console.log(c.gray + `  ⏱️ ${((Date.now() - start) / 1000).toFixed(1)}s | ${result.content.length} chars\n` + c.reset)
          progressBar(usedTokens(), config.numCtx)
        } catch (e) { console.log(c.red + "Hata: " + e.message + c.reset + "\n") }
        return ask()
      }

      let userContent = trimmed
      if (trimmed.startsWith("/code ")) userContent = `/think Kod yaz: ${trimmed.slice(6)}`
      else if (trimmed.startsWith("/math ")) userContent = `/think Matematik adim adim coz ve \\boxed{} ile bitir: ${trimmed.slice(6)}`
      else if (config.think && !userContent.startsWith("/think")) userContent = "/think " + userContent
      if (config.smith && !userContent.includes("[Smith")) userContent += " [Smith Otonom: 3-faz Context→Action→Verify, hata olursa duzelt]"

      history.push({ role: "user", content: userContent })
      saveHistory()

      // ── AI cevabi: temiz streaming (readline ile cakisma yok) ──
      console.log(c.green + `\n🤖 Agent (${config.model}):` + c.reset)
      console.log(c.gray + sep() + c.reset)
      const start = Date.now()
      let loopMessages = [...history]
      let iterations = 0
      const MAX_ITER = 5
      try {
        while (iterations < MAX_ITER) {
          iterations++
          const result = await callOllamaStreaming(loopMessages, {})

          // tool yok -> final (zaten stream edildi, sadece meta yaz)
          if (result.toolCalls.length === 0) {
            const m = result.content.match(/```(\w+)?\n([\s\S]*?)```/)
            if (m) lastCodeBlock = m[2]
            if (lastCodeBlock) console.log(c.gray + `  📋 Kod blogu var → /copy ile panoya kopyala` + c.reset)
            history.push({ role: "assistant", content: result.content, thinking: result.thinking })
            saveHistory()
            console.log(c.gray + `  ⏱️ ${((Date.now() - start) / 1000).toFixed(1)}s | ${result.content.length} chars | iter ${iterations}/${MAX_ITER}` + c.reset)
            progressBar(usedTokens(), config.numCtx)
            console.log()
            break
          }

          // Tool var -> kutulu goster (responsive)
          const tw = boxW()
          console.log(c.yellow + `\n  ┌─ 🔧 ${result.toolCalls.length} arac cagrisi (iter ${iterations}) ${"─".repeat(Math.max(0,tw-32))}┐` + c.reset)
          loopMessages.push({ role: "assistant", content: result.content || "", tool_calls: result.toolCalls })
          for (const tc of result.toolCalls) {
            const name = tc.function.name
            const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments
            console.log(c.blue + `  │ → ${name}(${JSON.stringify(args).slice(0, 70)})` + c.reset)
            const toolResult = await executeTool(name, args)
            const preview = String(toolResult).slice(0, 90).replace(/\n/g, " ")
            console.log(c.gray + `  │ ↳ ${preview}${String(toolResult).length > 90 ? "..." : ""}` + c.reset)
            loopMessages.push({ role: "tool", content: String(toolResult) })
          }
          console.log(c.yellow + `  └${"─".repeat(boxW())}┘` + c.reset)
          console.log(c.gray + `  ⏳ Sonuclar degerlendiriliyor...` + c.reset)
          if (iterations === MAX_ITER) { console.log(c.red + "  ⚠️ Max iterasyon" + c.reset); break }
        }
        if (iterations > 1) {
          // tool loop gectiyse gecmisi guncelle
          if (loopMessages.length > history.length) history = [...loopMessages]
          saveHistory()
        }
      } catch (e) {
        console.log(c.red + `\n❌ Hata: ${e.message}` + c.reset)
        if (String(e.message).includes("CUDA")) console.log(c.yellow + `  💡 Cozum: /ctx 8192 yap, /no_think dene, veya /model qwen2.5-coder:7b` + c.reset)
        console.log()
      }
      ask()
    })
  }
  ask()
}
main()
