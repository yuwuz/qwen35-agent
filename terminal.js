#!/usr/bin/env node
// Qwen35-Agent Terminal - Gelişmiş sürüm (web-ui ile senkron)
// Streaming + Tools + Vision + History

import readline from "node:readline"
import fs from "node:fs"
import path from "node:path"
import { spawn, exec } from "node:child_process"

const MODEL = "qwen35-agent"
const BASE_URL = "http://127.0.0.1:11434"
const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
}
function termW(){ return process.stdout.columns || 80 }
function boxW(){ return Math.max(32, Math.min(68, termW()-6)) }
function sep(ch="─"){ return ch.repeat(boxW()) }

function banner() {
  const w = boxW()
  // Kucuk pencerede ASCII art sigmasin diye responsive
  if(termW() >= 100){
    console.clear()
    console.log(colors.cyan + `
 ██████╗ ██╗    ██╗███████╗███╗   ██╗██████╗ ███████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗
██╔═══██╗██║    ██║██╔════╝████╗  ██║╚════██╗██╔════╝     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
██║   ██║██║ █╗ ██║█████╗  ██╔██╗ ██║ █████╔╝███████╗     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
██║▄▄ ██║██║███╗██║██╔══╝  ██║╚██╗██║ ╚═══██╗╚════██║     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
╚██████╔╝╚███╔███╔╝███████╗██║ ╚████║██████╔╝███████║     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
 ╚══▀▀═╝  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝╚═════╝ ╚══════╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
` + colors.reset)
  } else {
    console.clear()
    console.log(colors.cyan + `  ╭${"─".repeat(w)}╮` + colors.reset)
    console.log(colors.cyan + `  │  ${colors.bold}QWEN35-AGENT${colors.reset}${colors.cyan}  •  Terminal` + " ".repeat(Math.max(0,w-22)) + `│` + colors.reset)
    console.log(colors.cyan + `  ╰${"─".repeat(w)}╯` + colors.reset)
  }
  console.log(colors.gray + `  Model: ${MODEL} (qwen3.5:9b) | Vision ✓  Thinking ✓  256K ✓  Tools ✓  Streaming ✓`.slice(0,termW()-2) + colors.reset)
  console.log(colors.gray + `  Komutlar: /think /no_think  /vision <dosya>  /code  /math  /clear  /tools  /history  /exit`.slice(0,termW()-2) + colors.reset)
  console.log(colors.gray + `  ${sep()}` + colors.reset)
}

// === TOOLS (14 tools - web-ui ile aynı) ===
const TOOLS = [
  {type:"function", function:{name:"write_file", description:"Write content to a file. CRITICAL: If no directory specified, use ONLY filename like 'hello.txt' - auto-saves to Desktop A:\\AI\\qwen35-agent-test-workspace\\.", parameters:{type:"object", properties:{path:{type:"string"}, content:{type:"string"}}, required:["path","content"]}}},
  {type:"function", function:{name:"read_file", description:"Read file content. Supports offset/limit.", parameters:{type:"object", properties:{path:{type:"string"}, offset:{type:"number"}, limit:{type:"number"}}, required:["path"]}}},
  {type:"function", function:{name:"list_files", description:"List files in directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"edit_file", description:"Edit file by replacing exact string.", parameters:{type:"object", properties:{path:{type:"string"}, old_string:{type:"string"}, new_string:{type:"string"}}, required:["path","old_string","new_string"]}}},
  {type:"function", function:{name:"delete_file", description:"Delete file or empty directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"create_directory", description:"Create directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"search_files", description:"Search text in files (grep).", parameters:{type:"object", properties:{pattern:{type:"string"}, path:{type:"string"}, include:{type:"string"}}, required:["pattern"]}}},
  {type:"function", function:{name:"move_file", description:"Move/rename file.", parameters:{type:"object", properties:{source:{type:"string"}, destination:{type:"string"}}, required:["source","destination"]}}},
  {type:"function", function:{name:"run_python", description:"Execute Python code.", parameters:{type:"object", properties:{code:{type:"string"}}, required:["code"]}}},
  {type:"function", function:{name:"run_javascript", description:"Execute JavaScript via Node.", parameters:{type:"object", properties:{code:{type:"string"}}, required:["code"]}}},
  {type:"function", function:{name:"run_bash", description:"Execute bash/shell command.", parameters:{type:"object", properties:{command:{type:"string"}}, required:["command"]}}},
  {type:"function", function:{name:"web_search", description:"Search the internet via DuckDuckGo.", parameters:{type:"object", properties:{query:{type:"string"}}, required:["query"]}}},
  {type:"function", function:{name:"fetch_url", description:"Fetch URL and return text.", parameters:{type:"object", properties:{url:{type:"string"}}, required:["url"]}}},
  {type:"function", function:{name:"get_system_info", description:"Get system info.", parameters:{type:"object", properties:{}, required:[]}}},
]

function resolvePath(p){
  if(!p) return p
  if(/^[A-Za-z]:[\\/]/.test(p)) return path.normalize(p)
  const n = p.replace(/\//g,"\\")
  if(n.toLowerCase().startsWith("desktop\\") || n.toLowerCase()==="desktop"){
    const rel = n.replace(/^desktop[\\/]?/i,"")
    return rel ? path.join(DESKTOP, rel) : DESKTOP
  }
  if(!n.includes("\\") && !n.includes(":")) return path.join(DESKTOP, n)
  return path.join(DESKTOP, path.basename(n))
}

async function executeTool(name, args){
  try{
    if(typeof args === "string"){ try{ args = JSON.parse(args)}catch{ args={}} }
    if(name==="write_file"){
      const full = resolvePath(args.path)
      fs.mkdirSync(path.dirname(full), {recursive:true})
      fs.writeFileSync(full, args.content ?? "", "utf-8")
      return `✅ Written to ${full} (${(args.content||"").length} bytes)`
    }
    if(name==="read_file"){
      const full = resolvePath(args.path)
      const content = fs.readFileSync(full, "utf-8")
      const offset = args.offset || 1
      const limit = args.limit || 200
      const lines = content.split("\n")
      const start = Math.max(0, offset-1)
      const sliced = lines.slice(start, start+limit)
      const header = `File: ${full} (${lines.length} lines, showing ${start+1}-${start+sliced.length})\n${"─".repeat(50)}\n`
      return header + sliced.map((l,i)=> `${String(start+i+1).padStart(4," ")}: ${l}`).join("\n")
    }
    if(name==="list_files"){
      const full = resolvePath(args.path || DESKTOP)
      const files = fs.readdirSync(full).map(f=> {
        const fp = path.join(full,f)
        try{ const s=fs.statSync(fp); return `${s.isDirectory()?"DIR ":"FILE "}${f} (${s.size} bytes)` }catch{ return f }
      })
      return `Files in ${full}:\n${files.join("\n")}`
    }
    if(name==="edit_file"){
      const full = resolvePath(args.path)
      const content = fs.readFileSync(full, "utf-8")
      if(!content.includes(args.old_string)) throw new Error(`old_string bulunamadı`)
      const newContent = content.replace(args.old_string, args.new_string)
      fs.writeFileSync(full, newContent, "utf-8")
      return `✅ Edited ${full}`
    }
    if(name==="delete_file"){
      const full = resolvePath(args.path)
      const stat = fs.statSync(full)
      if(stat.isDirectory()) fs.rmdirSync(full)
      else fs.unlinkSync(full)
      return `✅ Deleted ${full}`
    }
    if(name==="create_directory"){
      const full = resolvePath(args.path)
      fs.mkdirSync(full, {recursive:true})
      return `✅ Created ${full}`
    }
    if(name==="search_files"){
      const pattern = args.pattern
      const searchPath = resolvePath(args.path || DESKTOP)
      const regex = new RegExp(pattern, "i")
      const results = []
      function walk(dir, depth=0){
        if(depth>3 || results.length>=30) return
        const entries = fs.readdirSync(dir, {withFileTypes:true})
        for(const e of entries){
          if(results.length>=30) break
          if(e.name.startsWith(".") || e.name==="node_modules" || e.name===".git") continue
          const full = path.join(dir, e.name)
          if(e.isDirectory()) try{ walk(full, depth+1) }catch{}
          else {
            try{
              const c = fs.readFileSync(full, "utf-8")
              c.split("\n").forEach((line, idx)=>{
                if(regex.test(line) && results.length<30) results.push(`${full}:${idx+1}: ${line.trim().slice(0,120)}`)
              })
            }catch{}
          }
        }
      }
      walk(searchPath)
      return results.length ? `Found ${results.length} for "${pattern}":\n`+results.join("\n") : `No matches for "${pattern}"`
    }
    if(name==="move_file"){
      const src = resolvePath(args.source)
      const dest = resolvePath(args.destination)
      fs.mkdirSync(path.dirname(dest), {recursive:true})
      fs.renameSync(src, dest)
      return `✅ Moved ${src} -> ${dest}`
    }
    if(name==="run_python"){
      return await new Promise((resolve, reject)=>{
        const proc = spawn("python", ["-c", args.code], {timeout:15000})
        let out="", err=""
        proc.stdout.on("data", d=> out+=d)
        proc.stderr.on("data", d=> err+=d)
        proc.on("close", code=> resolve((out||"") + (err? "\nERR: "+err:"") + ` (exit ${code})`))
        proc.on("error", e=> resolve(`ERR: ${e.message}`))
      })
    }
    if(name==="run_javascript"){
      return await new Promise(resolve=>{
        const proc = spawn("node", ["-e", args.code], {timeout:10000})
        let out="", err=""
        proc.stdout.on("data", d=> out+=d)
        proc.stderr.on("data", d=> err+=d)
        proc.on("close", code=> resolve((out||"") + (err? "\nERR: "+err:"") + ` (exit ${code})`))
        proc.on("error", e=> resolve(`ERR: ${e.message}`))
      })
    }
    if(name==="run_bash"){
      return await new Promise(resolve=>{
        exec(args.command, {timeout:10000}, (err, stdout, stderr)=>{
          resolve((stdout||"") + (stderr? "\nERR: "+stderr:"") + (err? `\nERR:${err.message}`:""))
        })
      })
    }
    if(name==="fetch_url"){
      const r = await fetch(args.url, {headers:{"User-Agent":"Mozilla/5.0 Qwen35-Agent"}})
      if(!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      const stripped = text.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,8000)
      return `Fetched ${args.url} (${text.length} chars):\n`+stripped
    }
    if(name==="get_system_info"){
      const os = await import("node:os")
      const cwd = process.cwd()
      let ollamaModels = "yok"
      try{ const r=await fetch("http://127.0.0.1:11434/api/tags"); const j=await r.json(); ollamaModels = j.models.map(m=>m.name).join(", ") }catch{}
      return `System: ${os.platform()} ${os.arch()} | ${os.cpus()[0]?.model} | RAM ${(os.totalmem()/1024/1024/1024).toFixed(1)}GB\nCWD: ${cwd}\nOllama: ${ollamaModels}`
    }
    if(name==="web_search"){
      try{
        const r = await fetch("http://127.0.0.1:5173/api/web-search", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query: args.query})})
        if(r.ok){
          const j = await r.json()
          if(j.ok && j.results.length) return `Web search for "${args.query}":\n` + j.results.map((x,i)=> `${i+1}. ${x.title}\n   ${x.url}\n   ${x.snippet}`).join("\n\n")
        }
      }catch{}
      try{
        const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, {headers:{"User-Agent":"Mozilla/5.0"}})
        const html = await r.text()
        const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
        const links = [...html.matchAll(linkRegex)].slice(0,3).map(m=> m[2].replace(/<[^>]+>/g,"").trim() + " - " + m[1].replace(/&amp;/g,"&"))
        if(links.length) return `Web search for "${args.query}":\n` + links.join("\n")
      }catch(e){ return `Web search error: ${e.message}` }
      return `Web search for "${args.query}" - sonuç yok`
    }
    return `Unknown tool ${name}`
  }catch(e){ return `❌ Tool error ${name}: ${e.message}` }
}

// === OLLAMA CHAT (CLEAN streaming - hatasiz, ic ice gecmez) ===
async function callOllamaStreaming(messages, options={}, onChunk){
  const body = {
    model: MODEL,
    messages,
    stream: true,
    options: {
      num_ctx: options.numCtx || 32768,
      temperature: options.temperature || 0.7,
    },
    tools: options.tools || TOOLS,
  }
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  let fullThinking = ""
  let toolCalls = []
  let lastChunk = null
  let thinkingOpen = false
  let thinkingClosed = false
  let contentStarted = false

  function openThinking(){
    if(!thinkingOpen){ thinkingOpen=true; const w=boxW(); process.stdout.write(`\n${colors.gray}┌─ 💭 Thinking ${"─".repeat(Math.max(0,w-14))}┐${colors.reset}\n${colors.gray}│ ${colors.reset}`) }
  }
  function closeThinking(){
    if(thinkingOpen && !thinkingClosed){ thinkingClosed=true; const w=boxW(); process.stdout.write(`${colors.reset}\n${colors.gray}└${"─".repeat(w)}┘${colors.reset}\n\n`) }
  }

  while(true){
    const {done, value} = await reader.read()
    if(done) break
    buffer += decoder.decode(value, {stream:true})
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for(const line of lines){
      if(!line.trim()) continue
      try{
        const chunk = JSON.parse(line)
        lastChunk = chunk
        if(chunk.message?.thinking){
          openThinking()
          fullThinking += chunk.message.thinking
          onChunk?.({thinking: chunk.message.thinking, fullThinking})
          const safe = chunk.message.thinking.replace(/\n/g, `\n${colors.gray}│ ${colors.reset}${colors.gray}`)
          process.stdout.write(colors.gray + safe + colors.reset)
        }
        if(chunk.message?.content){
          if(!contentStarted){ contentStarted=true; if(thinkingOpen && !thinkingClosed) closeThinking() }
          fullContent += chunk.message.content
          onChunk?.({content: chunk.message.content, fullContent})
          process.stdout.write(chunk.message.content)
        }
        if(chunk.message?.tool_calls) toolCalls = chunk.message.tool_calls
      }catch{}
    }
  }
  if(buffer.trim()){
    try{
      const chunk = JSON.parse(buffer)
      if(chunk.message?.thinking){ openThinking(); fullThinking += chunk.message.thinking; process.stdout.write(colors.gray + chunk.message.thinking + colors.reset) }
      if(chunk.message?.content){ if(!contentStarted){ contentStarted=true; if(thinkingOpen && !thinkingClosed) closeThinking() } fullContent += chunk.message.content; process.stdout.write(chunk.message.content) }
      if(chunk.message?.tool_calls) toolCalls = chunk.message.tool_calls
      lastChunk = chunk
    }catch{}
  }
  if(thinkingOpen && !thinkingClosed) closeThinking()
  if(contentStarted || thinkingOpen) process.stdout.write("\n")
  return {content: fullContent, thinking: fullThinking, toolCalls, raw: lastChunk}
}

async function callOllama(messages, options = {}) {
  const body = {
    model: MODEL,
    messages,
    stream: false,
    options: {
      num_ctx: options.numCtx || 32768,
      temperature: options.temperature || 0.7,
    },
    tools: options.tools || TOOLS,
  }
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data.message
}

async function imageToBase64(p) {
  const buf = fs.readFileSync(p)
  return buf.toString("base64")
}

async function main() {
  banner()

  try {
    const r = await fetch(`${BASE_URL}/api/tags`)
    if (!r.ok) throw new Error()
  } catch {
    console.log(colors.red + "\n❌ Ollama çalışmıyor! Lütfen önce 'ollama serve' çalıştırın." + colors.reset)
    console.log(colors.gray + "  Yeni bir CMD açıp: ollama serve" + colors.reset)
    try{ console.log(colors.yellow + "  Otomatik başlatılıyor..." + colors.reset); spawn("ollama", ["serve"], {detached:true, stdio:"ignore"}).unref(); await new Promise(r=>setTimeout(r,3000)) }catch{}
    // tekrar dene
    try{ const r=await fetch(`${BASE_URL}/api/tags`); if(r.ok) console.log(colors.green+"✅ Ollama bağlandı"+colors.reset) }catch{ process.exit(1) }
  }

  console.log(colors.green + "\n✅ Hazır! Mesaj yaz, /exit ile çık. Streaming + Tools aktif.\n" + colors.reset)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const history = []
  let thinkMode = false

  const ask = () => {
    const prefix = thinkMode ? colors.yellow + "[think ON] " + colors.reset : colors.gray + "[think OFF] " + colors.reset
    rl.question(prefix + colors.cyan + "Sen: " + colors.reset, async (input) => {
      const trimmed = input.trim()
      if (!trimmed) return ask()

      if (trimmed === "/exit" || trimmed === "/quit") {
        console.log(colors.gray + "\nGörüşürüz! 👋" + colors.reset)
        rl.close()
        process.exit(0)
      }
      if (trimmed === "/clear") {
        history.length = 0
        banner()
        console.log(colors.green + "✅ Temizlendi\n" + colors.reset)
        return ask()
      }
      if (trimmed === "/tools") {
        console.log(colors.blue + "\n🔧 Araçlar:" + colors.reset)
        TOOLS.forEach(t=> console.log(`  - ${t.function.name}: ${t.function.description.slice(0,60)}...`))
        console.log()
        return ask()
      }
      if (trimmed === "/history") {
        console.log(colors.magenta + `\n📜 Geçmiş (${history.length} mesaj):` + colors.reset)
        history.slice(-10).forEach((m,i)=> console.log(`  ${i+1}. [${m.role}] ${m.content.slice(0,80).replace(/\n/g," ")}${m.tool_calls? " 🔧":""}`))
        console.log()
        return ask()
      }
      if (trimmed === "/think") {
        thinkMode = true
        console.log(colors.yellow + "💭 Thinking AÇIK (zor sorular için)" + colors.reset + "\n")
        return ask()
      }
      if (trimmed === "/no_think") {
        thinkMode = false
        console.log(colors.gray + "💨 Thinking KAPALI (hızlı)" + colors.reset + "\n")
        return ask()
      }
      if (trimmed.startsWith("/vision ")) {
        const parts = trimmed.slice(8).trim().split(" ")
        const imgPath = parts[0]
        const q = parts.slice(1).join(" ") || "Bu görselde ne var? Detaylı analiz et."
        if (!fs.existsSync(imgPath)) {
          console.log(colors.red + `❌ Dosya bulunamadı: ${imgPath}` + colors.reset + "\n")
          return ask()
        }
        console.log(colors.yellow + `🖼️  Görsel analiz ediliyor: ${imgPath} ...` + colors.reset)
        const b64 = await imageToBase64(imgPath)
        history.push({ role: "user", content: q, images: [b64] })
        try {
          const start = Date.now()
          console.log(colors.green + `\n🤖 Agent: ` + colors.reset)
          const result = await callOllamaStreaming(history, {}, null)
          history.push({ role: "assistant", content: result.content })
          if(result.thinking) console.log(colors.gray + `\n[thinking ${result.thinking.length} chars]` + colors.reset)
          console.log(colors.gray + `\n  ⏱️ ${((Date.now() - start) / 1000).toFixed(1)}s\n` + colors.reset)
        } catch (e) {
          console.log(colors.red + "Hata: " + e.message + colors.reset + "\n")
        }
        return ask()
      }
      // Normal mesaj -> tool loop ile streaming
      let userContent = trimmed
      if (trimmed.startsWith("/code ")) {
        userContent = `/think Kod yaz: ${trimmed.slice(6)}`
      } else if (trimmed.startsWith("/math ")) {
        userContent = `/think Matematik adım adım çöz ve \\boxed{} ile bitir: ${trimmed.slice(6)}`
      } else if (thinkMode && !userContent.startsWith("/think")) {
        userContent = "/think " + userContent
      }
      history.push({ role: "user", content: userContent })

      // Tool loop (max 5 iter, streaming)
      console.log(colors.green + `\n🤖 Agent: ` + colors.reset)
      const start = Date.now()
      let loopMessages = [...history]
      let iterations = 0
      const MAX_ITER = 5
      try{
        while(iterations < MAX_ITER){
          iterations++
          let fullContent = ""
          let fullThinking = ""
          let toolCalls = []
          
          // Streaming chat
          const result = await callOllamaStreaming(loopMessages, {}, (chunk)=>{
            // chunk zaten yazılıyor, ekstra bir şey yapma
          })
          fullContent = result.content
          fullThinking = result.thinking
          toolCalls = result.toolCalls

          // thinking zaten kutulu stream edildi, tekrar yazma (ic ice gecmeyi onler)
          if(toolCalls.length===0){
            history.push({ role: "assistant", content: fullContent })
            console.log(colors.gray + `  ⏱️ ${((Date.now() - start) / 1000).toFixed(1)}s | ${fullContent.length} chars\n` + colors.reset)
            break
          }

          // Tool var (responsive)
          console.log(colors.yellow + `  ┌─ 🔧 ${toolCalls.length} araç çağrısı ${"─".repeat(Math.max(0,boxW()-24))}┐` + colors.reset)
          // Ollama spec: assistant tool_calls + tool results
          loopMessages.push({ role: "assistant", content: fullContent || "", tool_calls: toolCalls })
          for(const tc of toolCalls){
            const name = tc.function.name
            const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments
            console.log(colors.blue + `  → ${name}(${JSON.stringify(args).slice(0,80)})` + colors.reset)
            const result = await executeTool(name, args)
            console.log(colors.gray + `    ↳ ${String(result).slice(0,120).replace(/\n/g," ")}` + colors.reset)
            loopMessages.push({ role: "tool", content: String(result) })
          }
          console.log(colors.gray + `  └${sep()}┘` + colors.reset)
          console.log(colors.gray + `  ⏳ Sonuçlar değerlendiriliyor...` + colors.reset)
          // loop devam - bir sonraki iterasyonda model tool sonuçlarıyla cevap verecek
          if(iterations === MAX_ITER){
            console.log(colors.red + "  ⚠️ Max iterasyon" + colors.reset)
            break
          }
          // Sonraki iterasyon için history'i güncelle (tool sonuçları dahil)
          // history'ye sadece final cevabı ekleyeceğiz, ara tool mesajları loopMessages'ta
          // Ama eğer son iterasyonda tool yoksa history güncellenir
        }
        // Eğer loop tool ile bittiyse, son assistant mesajını history'ye ekle (zaten eklendi)
        // Tool loop sonrası history'yi loopMessages'tan senkronize et
        // Sadece son assistant içeriğini history'ye eklemek yeterli, ara mesajlar web-ui gibi tutulabilir
      } catch(e){
        console.log(colors.red + "\n❌ Hata: " + e.message + colors.reset + "\n")
        // Hata durumunda son kullanıcı mesajını geri al
        // history.pop()
      }
      ask()
    })
  }
  ask()
}

main()
