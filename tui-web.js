#!/usr/bin/env node
// Qwen35-Agent — Gerçek Tasarım Alanı TUI (tire/kutu karakteri YOK)
// Üstte AI mesajları kutu içinde (scroll), altta çerçeveli input, kod editörü kutusu + tool kutucuğu ayrı
import blessed from "blessed"
import fs from "node:fs"
import path from "node:path"
import { spawn, exec } from "node:child_process"

const MODEL_DEFAULT = "qwen35-agent"
const BASE_URL = "http://127.0.0.1:11434"
const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"
const HISTORY_FILE = path.join(DESKTOP, ".qwen35-history.json")
const CONFIG_FILE = path.join(DESKTOP, ".qwen35-config.json")

let cfg = { model: MODEL_DEFAULT, think: false, smith: true, numCtx: 32768, temp: 0.7 }
try { if (fs.existsSync(CONFIG_FILE)) cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE,"utf-8")) } } catch {}
const saveCfg = () => { try{ fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg,null,2)) }catch{} }

const TOOLS = [
  {type:"function", function:{name:"write_file", description:"Write content to a file.", parameters:{type:"object", properties:{path:{type:"string"}, content:{type:"string"}}, required:["path","content"]}}},
  {type:"function", function:{name:"read_file", description:"Read file content.", parameters:{type:"object", properties:{path:{type:"string"}, offset:{type:"number"}, limit:{type:"number"}}, required:["path"]}}},
  {type:"function", function:{name:"list_files", description:"List files in directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"edit_file", description:"Edit file.", parameters:{type:"object", properties:{path:{type:"string"}, old_string:{type:"string"}, new_string:{type:"string"}}, required:["path","old_string","new_string"]}}},
  {type:"function", function:{name:"delete_file", description:"Delete file.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"create_directory", description:"Create directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
  {type:"function", function:{name:"search_files", description:"Search text in files.", parameters:{type:"object", properties:{pattern:{type:"string"}, path:{type:"string"}, include:{type:"string"}}, required:["pattern"]}}},
  {type:"function", function:{name:"move_file", description:"Move/rename file.", parameters:{type:"object", properties:{source:{type:"string"}, destination:{type:"string"}}, required:["source","destination"]}}},
  {type:"function", function:{name:"run_python", description:"Execute Python code.", parameters:{type:"object", properties:{code:{type:"string"}}, required:["code"]}}},
  {type:"function", function:{name:"run_javascript", description:"Execute JS via Node.", parameters:{type:"object", properties:{code:{type:"string"}}, required:["code"]}}},
  {type:"function", function:{name:"run_bash", description:"Execute bash.", parameters:{type:"object", properties:{command:{type:"string"}}, required:["command"]}}},
  {type:"function", function:{name:"run_sandbox", description:"Kum havuzunda izole calistir.", parameters:{type:"object", properties:{filename:{type:"string"}, language:{type:"string", enum:["python","javascript","typescript","bun"]}, content:{type:"string"}}, required:["filename"]}}},
  {type:"function", function:{name:"web_search", description:"Search the internet.", parameters:{type:"object", properties:{query:{type:"string"}}, required:["query"]}}},
  {type:"function", function:{name:"fetch_url", description:"Fetch URL.", parameters:{type:"object", properties:{url:{type:"string"}}, required:["url"]}}},
  {type:"function", function:{name:"get_system_info", description:"Get system info.", parameters:{type:"object", properties:{}, required:[]}}},
]

function resolvePath(p){
  if(!p) return p
  if(/^[A-Za-z]:[\\/]/.test(p)) return path.normalize(p)
  const n=p.replace(/\//g,"\\")
  if(n.toLowerCase().startsWith("desktop\\")||n.toLowerCase()==="desktop"){ const rel=n.replace(/^desktop[\\/]?/i,""); return rel? path.join(DESKTOP,rel):DESKTOP }
  if(!n.includes("\\")&&!n.includes(":")) return path.join(DESKTOP,n)
  return path.join(DESKTOP, path.basename(n))
}
async function executeTool(name, args){
  try{
    if(typeof args==="string"){ try{ args=JSON.parse(args)}catch{ args={}} }
    if(name==="write_file"){ const f=resolvePath(args.path); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,args.content??"","utf-8"); return `written ${f} (${(args.content||"").length} bytes)` }
    if(name==="read_file"){ const f=resolvePath(args.path); const t=fs.readFileSync(f,"utf-8"); return t.slice(0,4000) }
    if(name==="list_files"){ const f=resolvePath(args.path||DESKTOP); return fs.readdirSync(f).slice(0,40).join("\n") }
    if(name==="edit_file"){ const f=resolvePath(args.path); const t=fs.readFileSync(f,"utf-8"); if(!t.includes(args.old_string)) throw new Error("old_string bulunamadi"); fs.writeFileSync(f,t.replace(args.old_string,args.new_string),"utf-8"); return `edited ${f}` }
    if(name==="delete_file"){ const f=resolvePath(args.path); const s=fs.statSync(f); if(s.isDirectory()) fs.rmdirSync(f); else fs.unlinkSync(f); return `deleted ${f}` }
    if(name==="create_directory"){ const f=resolvePath(args.path); fs.mkdirSync(f,{recursive:true}); return `created ${f}` }
    if(name==="search_files"){ const pat=args.pattern, dir=resolvePath(args.path||DESKTOP), re=new RegExp(pat,"i"); const out=[]; (function walk(d,depth=0){ if(depth>3||out.length>=30) return; for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(out.length>=30) break; if(e.name.startsWith(".")||e.name==="node_modules") continue; const full=path.join(d,e.name); if(e.isDirectory()) try{walk(full,depth+1)}catch{} else try{ const txt=fs.readFileSync(full,"utf-8"); txt.split("\n").forEach((ln,i)=>{ if(re.test(ln)&&out.length<30) out.push(`${full}:${i+1}: ${ln.trim().slice(0,100)}`) })}catch{} } })(dir); return out.length? out.join("\n") : `no matches` }
    if(name==="move_file"){ const s=resolvePath(args.source), d=resolvePath(args.destination); fs.mkdirSync(path.dirname(d),{recursive:true}); fs.renameSync(s,d); return `moved ${s} -> ${d}` }
    if(name==="run_python"){ return await new Promise(r=>{ const p=spawn("python",["-c",args.code],{timeout:15000}); let o="",e=""; p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>e+=d); p.on("close",c=>r((o||"")+(e?"\n"+e:"")+" (exit "+c+")")) }) }
    if(name==="run_javascript"){ return await new Promise(r=>{ const p=spawn("node",["-e",args.code],{timeout:10000}); let o="",e=""; p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>e+=d); p.on("close",c=>r((o||"")+(e?"\n"+e:"")+" (exit "+c+")")) }) }
    if(name==="run_bash"){ return await new Promise(r=>{ exec(args.command,{timeout:10000},(e,so,se)=> r((so||"")+(se?"\n"+se:"")+(e?"\nERR "+e.message:"")) ) }) }
    if(name==="fetch_url"){ const r=await fetch(args.url,{headers:{"User-Agent":"Mozilla/5.0"}}); if(!r.ok) throw new Error("HTTP "+r.status); const t=await r.text(); return t.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,6000) }
    if(name==="get_system_info"){ const os=await import("node:os"); let m="yok"; try{ const r=await fetch("http://127.0.0.1:11434/api/tags"); const j=await r.json(); m=j.models.map(x=>x.name).join(", ")}catch{}; return `${os.platform()} ${os.arch()} • ${m}` }
    if(name==="web_search"){ try{ const r=await fetch("http://127.0.0.1:5173/api/web-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:args.query})}); if(r.ok){ const j=await r.json(); if(j.ok&&j.results.length) return j.results.map((x,i)=>`${i+1}. ${x.title}\n   ${x.url}`).join("\n\n") } }catch{}; return "no results" }
    return "unknown tool "+name
  }catch(e){ return "tool error "+e.message }
}

function esc(s){ return String(s||"").replace(/\{/g,"\\{").replace(/\}/g,"\\}") }

// Basit syntax highlight — kod editörü gibi renkler
function highlightCode(code, lang=""){
  // kaçış
  let s = esc(code)
  // stringler yeşil
  s = s.replace(/(".*?"|'.*?'|`.*?`)/g, "{#7fd88f-fg}$1{/}")
  // sayılar turuncu
  s = s.replace(/\b(\d+\.?\d*)\b/g, "{#f5a742-fg}$1{/}")
  // keywordler mor
  s = s.replace(/\b(function|const|let|var|if|else|for|while|return|import|export|from|class|async|await|try|catch|new|typeof|instanceof|break|continue|switch|case|default|throw|extends|super|this|yield)\b/g, "{#9d7cd8-fg}$1{/}")
  // tipler / func isimleri
  s = s.replace(/\b(console|document|window|process|require|module|exports)\b/g, "{#56b6c2-fg}$1{/}")
  // yorumlar gri
  s = s.replace(/(\/\/.*$)/gm, "{#808080-fg}$1{/}")
  s = s.replace(/(#.*$)/gm, "{#808080-fg}$1{/}")
  return s
}

function formatWithCodeBlocks(content){
  // ``` bloklarını ayır, kod blokları için editör kutusu yapacağız
  const parts = content.split(/```(\w+)?\n?([\s\S]*?)```/g)
  // parts: [text, lang, code, text, lang, code...]
  let out = ""
  for(let i=0;i<parts.length;i+=3){
    const text = parts[i] || ""
    const lang = parts[i+1] || ""
    const code = parts[i+2]
    if(text) out += esc(text) + "\n"
    if(code !== undefined){
      const lines = code.trimEnd().split("\n")
      // editör header
      out += `\n{#1e1e1e-bg}{#808080-fg}  ${lang || "code"}  ·  ${lines.length} satır{/}\n`
      // kod satırları: solda numara
      lines.forEach((line, idx)=>{
        const num = String(idx+1).padStart(3," ")
        const hl = highlightCode(line, lang)
        out += `{#1e1e1e-bg}{#606060-fg}${num} {/}{#1e1e1e-bg} ${hl} {/}\n`
      })
      out += `\n`
    }
  }
  return out
}

// ── Screen ──
const screen = blessed.screen({
  smartCSR: true,
  title: "Qwen35-Agent — tasarım alanı",
  fullUnicode: true,
  dockBorders: false,
  autoPadding: true,
})

// Header — arka plan blok, border YOK
const header = blessed.box({
  top: 0, left: 0, width: "100%", height: 3,
  style: { bg: "#141414", fg: "#eeeeee" },
  tags: true,
})
screen.append(header)

function renderHeader(status="hazır"){
  const think = cfg.think ? "{#7fd88f-fg}● thinking{/}" : "{#808080-fg}○ thinking{/}"
  const smith = cfg.smith ? "{#7fd88f-fg}● smith{/}" : "{#808080-fg}○ smith{/}"
  header.setContent(` {#9d7cd8-fg}{bold}⬢ qwen35-agent{/}  {#808080-fg}·{/}  ${cfg.model}  {#808080-fg}·{/}  ${think}  {#808080-fg}·{/}  ${smith}\n {#606060-fg} ${esc(status)}  ·  ctx ${cfg.numCtx}  ·  ${TOOLS.length} tools{/}`)
}

// Chat alanı — TIKANDIĞI YER: burası yukarıdan aşağıya kutu içinde (scroll)
// Arka plan #0a0a0a, her mesaj ayrı kutu (üst üste binmez)
const chat = blessed.box({
  top: 3, left: 0, width: "100%", height: "100%-7",
  style: { bg: "#0a0a0a" },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { ch: " ", style: { bg: "#3c3c3c" } },
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
})
screen.append(chat)

// Mesaj kutularını tut — her mesaj ayrı blessed.box, iç içe girmez
const messageBoxes = []

function clearChat(){
  messageBoxes.forEach(b=> { try{ b.destroy() }catch{} })
  messageBoxes.length = 0
  chat.children.slice().forEach(ch=> { try{ ch.detach() }catch{} })
}

function addUserBox(text){
  const box = blessed.box({
    parent: chat,
    width: "100%-2",
    left: 1,
    height: "shrink",
    tags: true,
    padding: { left: 1, right: 1, top: 1, bottom: 1 },
    style: { bg: "#1a1a1a", fg: "#eeeeee" },
  })
  // sol vurgu — accent bar (1px) yerine bg ile ve sol boşluk
  // blessed'te sol border yok, bu yüzden içeriği ▎ ile başlat
  box.setContent(`{#9d7cd8-fg}▎{/}  {bold}${esc(text)}{/}`)
  messageBoxes.push(box)
  chat.append(box)
}

function addToolBox(name, content){
  const box = blessed.box({
    parent: chat,
    width: "100%-2",
    left: 1,
    height: "shrink",
    tags: true,
    padding: { left: 2, right: 1, top: 1, bottom: 1 },
    style: { bg: "#1e1e1e", fg: "#eeeeee" },
  })
  // tool kutucuğu ayrı — başlık + içerik
  const preview = esc(content.slice(0,200).replace(/\n/g," "))
  box.setContent(`{#f5a742-fg}● ${esc(name)}{/}  {#808080-fg}${preview}{/}`)
  messageBoxes.push(box)
  chat.append(box)
}

function addAssistantBox(content, thinking){
  const box = blessed.box({
    parent: chat,
    width: "100%-2",
    left: 1,
    height: "shrink",
    tags: true,
    padding: { left: 1, right: 1, top: 1, bottom: 1 },
    style: { bg: "#141414", fg: "#eeeeee" },
  })
  let out = ""
  if(thinking){
    out += `{#606060-fg}${esc(thinking.slice(0,300).replace(/\n/g," "))}{/}\n\n`
  }
  out += formatWithCodeBlocks(content)
  out += `\n{#606060-fg}▣ assistant · ${cfg.model}{/}`
  box.setContent(out)
  messageBoxes.push(box)
  chat.append(box)
  return box
}

function rerender(){
  // blessed'te shrink box'lar için yeniden layout gerek
  chat.setScrollPerc(100)
  screen.render()
}

// Input alanı — aşağıda ÇERÇEVELİ (bg ile çerçeve, tire yok)
// Dış çerçeve #0a0a0a bg, iç input #1e1e1e bg, sol accent 1px
const inputWrap = blessed.box({
  bottom: 0, left: 0, width: "100%", height: 7,
  style: { bg: "#0a0a0a" },
})
screen.append(inputWrap)

// üst ince ayırıcı — bg ile, tire değil
const divider = blessed.box({
  top: 0, left: 0, width: "100%", height: 1,
  style: { bg: "#282828" },
})
inputWrap.append(divider)

const inputFrame = blessed.box({
  top: 1, left: 1, width: "100%-2", height: 4,
  style: { bg: "#1e1e1e" },
})
inputWrap.append(inputFrame)

const accentBar = blessed.box({
  top: 0, left: 0, width: 1, height: 4,
  style: { bg: "#9d7cd8" },
})
inputFrame.append(accentBar)

const input = blessed.textarea({
  parent: inputFrame,
  top: 0, left: 2, width: "100%-4", height: 4,
  inputOnFocus: true,
  keys: true,
  mouse: true,
  style: { bg: "#1e1e1e", fg: "#eeeeee", focus: { bg: "#282828" } },
})

const hint = blessed.text({
  parent: inputWrap,
  bottom: 0, left: 2, width: "100%-2", height: 1,
  content: " enter gönder  ·  shift+enter satır  ·  /help komutlar  ·  ctrl+l temizle  ·  ctrl+c çık",
  style: { bg: "#0a0a0a", fg: "#606060" },
})

// Geçmiş
let history = []
try{ if(fs.existsSync(HISTORY_FILE)) history = JSON.parse(fs.readFileSync(HISTORY_FILE,"utf-8")).slice(-60) }catch{}
const saveHistory = ()=>{ try{ fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-80),null,2)) }catch{} }

// ilk yükleme: geçmişi kutulara ekle
history.forEach(m=>{
  if(m.role==="user") addUserBox(m.content)
  else if(m.role==="tool") addToolBox(m.tool||"tool", m.content)
  else if(m.role==="assistant") addAssistantBox(m.content, m.thinking)
})
rerender()

async function handleSubmit(raw){
  const text = raw.trim()
  if(!text) return
  if(text==="/clear"){ history=[]; saveHistory(); clearChat(); rerender(); renderHeader("temizlendi"); screen.render(); return }
  if(text==="/think"){ cfg.think=true; saveCfg(); renderHeader("thinking açık"); screen.render(); return }
  if(text==="/no_think"){ cfg.think=false; saveCfg(); renderHeader("thinking kapalı"); screen.render(); return }
  if(text==="/help"){
    addAssistantBox("Komutlar: /clear  /think  /no_think  /model qwen3.5:9b  /ctx 32K\nDoğrudan mesaj yaz ve enter ile gönder. Kod yazınca editör kutusu, tool çağrılınca ayrı kutucuk gelir.")
    rerender(); return
  }
  if(text.startsWith("/model")){ const arg=text.slice(6).trim(); if(arg){ cfg.model=arg; saveCfg(); renderHeader("model → "+arg); screen.render() } return }

  let userContent = text
  if(cfg.think && !userContent.startsWith("/think")) userContent="/think "+userContent
  if(cfg.smith && !userContent.includes("[Smith")) userContent+=" [Smith Otonom]"

  // kullanıcı kutusu ekle
  addUserBox(text)
  history.push({role:"user", content: text})
  saveHistory()
  rerender()
  renderHeader("yazıyor…"); screen.render()

  // loop için: history'deki son user'ı userContent ile değiştir
  let loopMsgs = [...history.slice(0,-1).map(m=> ({role:m.role, content:m.content})), {role:"user", content: userContent}]

  try{
    let iter=0
    let finalContent=""

    while(iter<5){
      iter++
      const body = { model: cfg.model, messages: loopMsgs, stream: true, options:{ num_ctx: cfg.numCtx, temperature: cfg.temp }, tools: TOOLS }
      const res = await fetch(`${BASE_URL}/api/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) })
      if(!res.ok) throw new Error(await res.text())
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf="", toolCalls=[]
      let accContent="", accThinking=""

      // yeni streaming kutusu — yukarıdan aşağıya kutu içinde akar
      const streamingBox = blessed.box({
        parent: chat,
        width: "100%-2",
        left: 1,
        height: "shrink",
        tags: true,
        padding: { left: 1, right: 1, top: 1, bottom: 1 },
        style: { bg: "#141414", fg: "#eeeeee" },
      })
      messageBoxes.push(streamingBox)
      chat.append(streamingBox)
      rerender()

      while(true){
        const {done, value} = await reader.read(); if(done) break
        buf+=dec.decode(value,{stream:true})
        const lines=buf.split("\n"); buf=lines.pop()||""
        for(const line of lines){
          if(!line.trim()) continue
          try{
            const ch=JSON.parse(line)
            if(ch.message?.thinking){ accThinking+=ch.message.thinking; streamingBox.setContent(`{#606060-fg}${esc(accThinking.slice(0,600))}{/}\n\n${formatWithCodeBlocks(accContent)}`); rerender() }
            if(ch.message?.content){ accContent+=ch.message.content; streamingBox.setContent(`${accThinking ? `{#606060-fg}${esc(accThinking.slice(0,600))}{/}\n\n` : ""}${formatWithCodeBlocks(accContent)}`); rerender() }
            if(ch.message?.tool_calls) toolCalls=ch.message.tool_calls
          }catch{}
        }
      }
      if(buf.trim()){
        try{ const ch=JSON.parse(buf); if(ch.message?.thinking) accThinking+=ch.message.thinking; if(ch.message?.content) accContent+=ch.message.content; if(ch.message?.tool_calls) toolCalls=ch.message.tool_calls; streamingBox.setContent(`${accThinking ? `{#606060-fg}${esc(accThinking.slice(0,600))}{/}\n\n` : ""}${formatWithCodeBlocks(accContent)}`); rerender() }catch{}
      }

      streamingBox.setContent(`${accThinking ? `{#606060-fg}${esc(accThinking.slice(0,600))}{/}\n\n` : ""}${formatWithCodeBlocks(accContent)}\n{#606060-fg}▣ assistant · ${cfg.model}{/}`)
      rerender()

      finalContent = accContent
      if(toolCalls.length===0){
        history.push({role:"assistant", content: accContent, thinking: accThinking})
        saveHistory()
        break
      }

      // tool kutucukları — her tool için ayrı kutu
      const toolResults = []
      for(const tc of toolCalls){
        const name=tc.function.name
        const args = typeof tc.function.arguments==="string" ? JSON.parse(tc.function.arguments) : tc.function.arguments
        addToolBox(name, JSON.stringify(args).slice(0,140))
        rerender()
        const out = await executeTool(name, args)
        addToolBox(name, out.slice(0,500))
        rerender()
        toolResults.push(out)
      }
      // loop ve history için tool'ları ekle
      history.push({role:"assistant", content: accContent, thinking: accThinking})
      for(let i=0;i<toolCalls.length;i++) history.push({role:"tool", content: toolResults[i], tool: toolCalls[i].function.name})
      saveHistory()
      loopMsgs.push({role:"assistant", content: accContent, tool_calls: toolCalls})
      for(const r of toolResults) loopMsgs.push({role:"tool", content: r})
      if(iter>=5) break
    }

    renderHeader(`bitti • ${finalContent.length} chars`)
    screen.render()
  }catch(e){
    addAssistantBox("❌ hata: "+e.message, "")
    rerender()
    renderHeader("hata")
    screen.render()
  }
}

// Input events
input.key("enter", ()=>{
  const v = input.getValue()
  handleSubmit(v)
  input.clearValue()
  input.focus()
  screen.render()
})
input.key(["C-l"], ()=>{ history=[]; saveHistory(); clearChat(); rerender(); })
screen.key(["C-c"], ()=> process.exit(0))
screen.key(["escape"], ()=> input.focus())
chat.key(["pageup"], ()=> chat.scroll(-5))
chat.key(["pagedown"], ()=> chat.scroll(5))

// İlk render
renderHeader()
screen.render()
input.focus()

// Ollama kontrol
fetch(`${BASE_URL}/api/tags`).then(async r=>{
  if(r.ok){
    const j=await r.json()
    renderHeader(`bağlı • ${j.models?.map(m=>m.name).join(", ").slice(0,40) || "ollama"}`)
    screen.render()
  } else {
    renderHeader("ollama bağlı değil")
    screen.render()
  }
}).catch(()=>{
  renderHeader("ollama kapalı — ollama serve")
  screen.render()
})
