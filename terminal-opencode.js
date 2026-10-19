#!/usr/bin/env node
// Qwen35-Agent — opencode tarzı minimal TUI (kutular yok, responsive, küçülünce bozulmaz)
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

// opencode palette: muted, theme-aware
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", italic: "\x1b[3m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m", gray: "\x1b[90m",
  accent: "\x1b[38;5;99m", muted: "\x1b[38;5;245m", border: "\x1b[38;5;238m",
}

let config = { model: MODEL_DEFAULT, think: false, stream: true, smith: true, numCtx: 32768, temp: 0.7 }
try { if (fs.existsSync(CONFIG_FILE)) config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE,"utf-8")) }} catch{}
function saveConfig(){ try{ fs.writeFileSync(CONFIG_FILE, JSON.stringify(config,null,2)) }catch{} }

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

const MODELS = [
  { id:"qwen35-agent", label:"qwen35-agent ★", desc:"256K • Vision • Thinking • Tools" },
  { id:"qwen3.5:9b", label:"qwen3.5:9b", desc:"256K • Vision • 6.6GB" },
  { id:"qwen2.5-coder:7b", label:"qwen2.5-coder:7b", desc:"32K • Kod Uzmani" },
  { id:"llama3.1:8b-instruct-q4_K_M", label:"llama3.1:8b", desc:"128K • Genel" },
  { id:"dolphin-llama3:8b", label:"dolphin-llama3:8b", desc:"8K • Sansursuz" },
]

// responsive: opencode gibi flex — tek satir separator, kutu yok
function W(){ return process.stdout.columns || 80 }
function hr(char="─"){ return char.repeat(Math.max(20, W()-2)) }
function hrDim(){ return c.border + hr() + c.reset }
function truncate(s, max){ const r=s.replace(/\x1b\[[0-9;]*m/g,""); return r.length>max ? s.slice(0,max-1)+"…" : s }

function header(){
  console.clear()
  // opencode tarzı: sade, kutu yok, sol border yerine sadece renkli başlık
  const title = `${c.bold}${c.white}qwen35-agent${c.reset}  ${c.muted}•${c.reset}  ${c.accent}${config.model}${c.reset}  ${c.muted}•${c.reset}  ${c.dim}opencode-style${c.reset}`
  console.log(title)
  // durum satırı: opencode'daki gibi noktalı, kutusuz
  const dot = (on)=> on ? c.green+"●"+c.reset : c.muted+"○"+c.reset
  const line = `  ${dot(config.think)} thinking  ${dot(config.stream)} streaming  ${dot(config.smith)} smith  ${c.muted}·${c.reset}  ctx ${c.white}${config.numCtx}${c.reset}  temp ${c.white}${config.temp}${c.reset}  ${c.muted}·${c.reset}  ${TOOLS.length} tools`
  console.log(line)
  console.log(hrDim())
}

function footer(used, total){
  const pct = Math.min(100, Math.round(used/total*100))
  const barW = Math.max(10, Math.min(24, W()-50))
  const fill = Math.round(barW*pct/100)
  const bar = c.accent+"█".repeat(fill)+c.muted+"░".repeat(barW-fill)+c.reset
  const col = pct>85?c.red:pct>60?c.yellow:c.green
  console.log(`  ${col}${pct}%${c.reset} ${bar}  ${c.muted}${used}/${total} • kalan ${total-used}${c.reset}`)
}

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
    if(name==="read_file"){ const f=resolvePath(args.path); const t=fs.readFileSync(f,"utf-8"); const off=args.offset||1, lim=args.limit||60; const ls=t.split("\n"); const s=Math.max(0,off-1); return `File: ${f} (${ls.length} lines)\n`+ls.slice(s,s+lim).map((l,i)=>`${String(s+i+1).padStart(4," ")}  ${l}`).join("\n") }
    if(name==="list_files"){ const f=resolvePath(args.path||DESKTOP); const ls=fs.readdirSync(f).slice(0,60).map(x=>{ try{ const s=fs.statSync(path.join(f,x)); return `${s.isDirectory()?"dir":"file"}  ${x}`}catch{return x}}); return ls.join("\n") }
    if(name==="edit_file"){ const f=resolvePath(args.path); const t=fs.readFileSync(f,"utf-8"); if(!t.includes(args.old_string)) throw new Error("old_string bulunamadi"); fs.writeFileSync(f,t.replace(args.old_string,args.new_string),"utf-8"); return `edited ${f}` }
    if(name==="delete_file"){ const f=resolvePath(args.path); const s=fs.statSync(f); if(s.isDirectory()) fs.rmdirSync(f); else fs.unlinkSync(f); return `deleted ${f}` }
    if(name==="create_directory"){ const f=resolvePath(args.path); fs.mkdirSync(f,{recursive:true}); return `created ${f}` }
    if(name==="search_files"){ const pat=args.pattern, dir=resolvePath(args.path||DESKTOP), re=new RegExp(pat,"i"); const out=[]; (function walk(d,depth=0){ if(depth>3||out.length>=30) return; for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(out.length>=30) break; if(e.name.startsWith(".")||e.name==="node_modules") continue; const full=path.join(d,e.name); if(e.isDirectory()) try{walk(full,depth+1)}catch{} else try{ const txt=fs.readFileSync(full,"utf-8"); txt.split("\n").forEach((ln,i)=>{ if(re.test(ln)&&out.length<30) out.push(`${full}:${i+1}: ${ln.trim().slice(0,120)}`) })}catch{} } })(dir); return out.length? out.join("\n") : `no matches for "${pat}"` }
    if(name==="move_file"){ const s=resolvePath(args.source), d=resolvePath(args.destination); fs.mkdirSync(path.dirname(d),{recursive:true}); fs.renameSync(s,d); return `moved ${s} -> ${d}` }
    if(name==="run_python"){ return await new Promise(r=>{ const p=spawn("python",["-c",args.code],{timeout:15000}); let o="",e=""; p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>e+=d); p.on("close",c=>r((o||"")+(e?"\n"+e:"")+" (exit "+c+")")); p.on("error",er=>r("ERR "+er.message)) }) }
    if(name==="run_javascript"){ return await new Promise(r=>{ const p=spawn("node",["-e",args.code],{timeout:10000}); let o="",e=""; p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>e+=d); p.on("close",c=>r((o||"")+(e?"\n"+e:"")+" (exit "+c+")")) }) }
    if(name==="run_bash"){ return await new Promise(r=>{ exec(args.command,{timeout:10000},(e,so,se)=> r((so||"")+(se?"\n"+se:"")+(e?"\nERR "+e.message:"")) ) }) }
    if(name==="run_sandbox"){ try{ const rr=await fetch("http://127.0.0.1:5173/api/run-sandbox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:args.filename,language:args.language,content:args.content})}); const j=await rr.json(); return j.ok? j.output.slice(0,3000): j.error.slice(0,2000) }catch(e){ return "sandbox hata "+e.message } }
    if(name==="fetch_url"){ const r=await fetch(args.url,{headers:{"User-Agent":"Mozilla/5.0"}}); if(!r.ok) throw new Error("HTTP "+r.status); const t=await r.text(); return t.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,8000) }
    if(name==="get_system_info"){ const os=await import("node:os"); let m="yok"; try{ const r=await fetch("http://127.0.0.1:11434/api/tags"); const j=await r.json(); m=j.models.map(x=>x.name).join(", ")}catch{}; return `${os.platform()} ${os.arch()} • ${os.cpus()[0]?.model} • ${(os.totalmem()/1024/1024/1024).toFixed(1)}GB • ${m}` }
    if(name==="web_search"){ try{ const r=await fetch("http://127.0.0.1:5173/api/web-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:args.query})}); if(r.ok){ const j=await r.json(); if(j.ok&&j.results.length) return j.results.map((x,i)=>`${i+1}. ${x.title}\n   ${x.url}\n   ${x.snippet}`).join("\n\n") } }catch{}; try{ const r=await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`,{headers:{"User-Agent":"Mozilla/5.0"}}); const h=await r.text(); const re=/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g; const ls=[...h.matchAll(re)].slice(0,3).map(m=>m[2].replace(/<[^>]+>/g,"").trim()+" - "+m[1].replace(/&amp;/g,"&")); if(ls.length) return ls.join("\n") }catch(e){ return "search error "+e.message } return "no results" }
    return "unknown tool "+name
  }catch(e){ return "tool error "+name+": "+e.message }
}

// opencode tarzı streaming: thinking dim italic, content normal, kutu yok, sadece sol çubuk
async function streamChat(messages, opts={}){
  const body={ model: opts.model||config.model, messages, stream:true, options:{ num_ctx:opts.numCtx||config.numCtx, temperature: opts.temperature ?? config.temp }, tools: opts.tools||TOOLS }
  const res=await fetch(`${BASE_URL}/api/chat`,{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)})
  if(!res.ok) throw new Error(await res.text())
  const reader=res.body.getReader(), dec=new TextDecoder()
  let buf="", thinking="", content="", toolCalls=[], last=null
  let thinkingStarted=false, contentStarted=false

  function prefixThinking(s){
    // opencode'da thinking sol border ile dim gösterilir, kutu yok
    return s.replace(/\n/g, `\n${c.muted}│ ${c.reset}${c.dim}`)
  }

  while(true){
    const {done,value}=await reader.read(); if(done) break
    buf+=dec.decode(value,{stream:true})
    const lines=buf.split("\n"); buf=lines.pop()||""
    for(const line of lines){
      if(!line.trim()) continue
      try{
        const ch=JSON.parse(line); last=ch
        if(ch.message?.thinking){
          if(!thinkingStarted){ thinkingStarted=true; process.stdout.write(`\n${c.muted}│ ${c.reset}${c.dim}`) }
          thinking+=ch.message.thinking
          process.stdout.write(c.dim + prefixThinking(ch.message.thinking) + c.reset)
        }
        if(ch.message?.content){
          if(!contentStarted){
            contentStarted=true
            if(thinkingStarted) process.stdout.write(`${c.reset}\n${hrDim()}\n`)
            else process.stdout.write("\n")
          }
          content+=ch.message.content
          process.stdout.write(ch.message.content)
        }
        if(ch.message?.tool_calls) toolCalls=ch.message.tool_calls
      }catch{}
    }
  }
  if(buf.trim()){
    try{ const ch=JSON.parse(buf); if(ch.message?.thinking){ if(!thinkingStarted) process.stdout.write(`\n${c.muted}│ ${c.reset}${c.dim}`); thinking+=ch.message.thinking; process.stdout.write(c.dim+ch.message.thinking+c.reset) } if(ch.message?.content){ if(!contentStarted){ if(thinkingStarted) process.stdout.write(`${c.reset}\n${hrDim()}\n`); contentStarted=true } content+=ch.message.content; process.stdout.write(ch.message.content) } if(ch.message?.tool_calls) toolCalls=ch.message.tool_calls; last=ch }catch{}
  }
  if(thinkingStarted) process.stdout.write(c.reset+"\n")
  if(contentStarted || thinkingStarted) process.stdout.write("\n")
  return { content, thinking, toolCalls, raw:last }
}

async function imageToBase64(p){ return fs.readFileSync(p).toString("base64") }

function help(){
  console.log(`
${c.bold}komutlar${c.reset}  ${c.muted}(opencode tarzı)${c.reset}
  ${c.cyan}/help${c.reset}            yardım
  ${c.cyan}/model [1-5|isim]${c.reset}  model değiştir
  ${c.cyan}/think${c.reset} ${c.muted}·${c.reset} ${c.cyan}/no_think${c.reset}  thinking aç/kapat
  ${c.cyan}/stream /smith /ctx /temp${c.reset}
  ${c.cyan}/clear /new /history${c.reset}
  ${c.cyan}/files [yol] /read /write${c.reset}
  ${c.cyan}/vision <dosya> [soru]${c.reset}
  ${c.cyan}/code /math /web /copy /ui${c.reset}
`)
}

async function main(){
  header()
  try{ const r=await fetch(`${BASE_URL}/api/tags`); if(!r.ok) throw 0; console.log(`${c.green}●${c.reset} ollama bağlı  ${c.muted}${BASE_URL}${c.reset}`); try{ const j=await r.json(); console.log(`${c.muted}  ${j.models.map(m=>m.name).join(", ").slice(0,W()-4)}${c.reset}`)}catch{} }catch{ console.log(`${c.red}● ollama kapalı${c.reset} ${c.muted}— ollama serve ile başlat${c.reset}`); try{ spawn("ollama",["serve"],{detached:true,stdio:"ignore"}).unref(); await new Promise(r=>setTimeout(r,1500)) }catch{} }

  let history=[]; try{ if(fs.existsSync(HISTORY_FILE)) history=JSON.parse(fs.readFileSync(HISTORY_FILE,"utf-8")) }catch{}
  const save=()=>{ try{ fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-80),null,2)) }catch{} }
  const used=()=> history.reduce((a,m)=>a+Math.ceil((m.content||"").length/4)+(m.images?600:0),0)

  if(history.length) footer(used(), config.numCtx)
  console.log(`${c.muted}· ${c.reset}${c.dim}mesaj yaz, ${c.reset}${c.cyan}/help${c.reset} ${c.dim}ile komutlar${c.reset}`)
  console.log(hrDim())

  const rl=readline.createInterface({ input: process.stdin, output: process.stdout })
  let lastCode=""

  // opencode'daki gibi pencere küçülünce header bozulmaz — sadece hr yeniden çizilir, kutu yok
  process.stdout.on("resize", ()=>{ /* bir sonraki çizimde W() yeniden hesaplanır */ })

  const ask=()=>{
    const hint = `${c.muted}${used()}/${config.numCtx}${c.reset}`
    const prefix = config.think ? `${c.yellow}●${c.reset} ` : `${c.muted}○${c.reset} `
    rl.question(`${prefix}${c.white}> ${c.reset}`, async (input)=>{
      const t=input.trim(); if(!t) return ask()
      if(t==="/help"||t==="/?"){ help(); return ask() }
      if(t==="/clear"){ history=[]; save(); header(); console.log(`${c.green}temizlendi${c.reset}\n`); return ask() }
      if(t==="/new"){ history=[]; save(); console.log(`${c.green}yeni sohbet${c.reset}\n`); return ask() }
      if(t==="/history"){
        if(!history.length){ console.log(`${c.muted}henüz mesaj yok${c.reset}\n`); return ask() }
        console.log(`\n${c.bold}geçmiş${c.reset} ${c.muted}${history.length} mesaj${c.reset}`)
        history.slice(-12).forEach((m,i)=>{ const who=m.role==="user"?c.cyan+"sen"+c.reset:c.green+"agent"+c.reset; console.log(` ${c.muted}${String(i+1).padStart(2," ")}${c.reset} ${who}  ${m.content.slice(0,W()-12).replace(/\n/g," ")}`) })
        footer(used(),config.numCtx); console.log(); return ask()
      }
      if(t.startsWith("/model")){
        const arg=t.slice(6).trim(); if(!arg){ MODELS.forEach((m,i)=>{ const a=m.id===config.model?c.green+" ●"+c.reset:""; console.log(` ${i+1}. ${c.cyan}${m.id}${c.reset}  ${c.muted}${m.desc}${c.reset}${a}`)}); console.log(`${c.muted}  /model 2  veya  /model qwen3.5:9b${c.reset}\n`); return ask() }
        let trg=arg; if(/^[1-5]$/.test(arg)) trg=MODELS[parseInt(arg)-1]?.id; if(!MODELS.find(m=>m.id===trg)){ console.log(`${c.red}model bulunamadı${c.reset}\n`); return ask() } config.model=trg; saveConfig(); console.log(`${c.green}model → ${trg}${c.reset}\n`); header(); return ask()
      }
      if(t==="/think"){ config.think=true; saveConfig(); console.log(`${c.green}thinking açık${c.reset}\n`); header(); return ask() }
      if(t==="/no_think"){ config.think=false; saveConfig(); console.log(`${c.muted}thinking kapalı${c.reset}\n`); header(); return ask() }
      if(t==="/stream"){ config.stream=!config.stream; saveConfig(); console.log(`${config.stream?c.green+"streaming açık":c.muted+"streaming kapalı"}${c.reset}\n`); return ask() }
      if(t==="/smith"){ config.smith=!config.smith; saveConfig(); console.log(`${config.smith?c.green+"smith açık":c.muted+"smith kapalı"}${c.reset}\n`); return ask() }
      if(t.startsWith("/ctx")){ const v=t.split(" ")[1]; const map={"8k":8192,"32k":32768,"64k":65536,"128k":131072,"256k":262144}; const n=map[v?.toLowerCase()]||parseInt(v,10); if(!n){ console.log(`${c.muted}mevcut ${config.numCtx}${c.reset}\n`); return ask()} config.numCtx=n; saveConfig(); console.log(`${c.green}ctx → ${n}${c.reset}\n`); return ask() }
      if(t.startsWith("/temp")){ const v=parseFloat(t.split(" ")[1]); if(isNaN(v)){ console.log(`${c.muted}temp ${config.temp}${c.reset}\n`); return ask()} config.temp=Math.max(0,Math.min(2,v)); saveConfig(); console.log(`${c.green}temp → ${config.temp}${c.reset}\n`); return ask() }
      if(t==="/tools"){ console.log(`\n${c.bold}araçlar${c.reset} ${c.muted}15${c.reset}`); [["dosya",["write_file","read_file","list_files","edit_file","delete_file","create_directory","search_files","move_file"]],["kod",["run_python","run_javascript","run_bash","run_sandbox"]],["web",["web_search","fetch_url","get_system_info"]]].forEach(([title,names])=>{ console.log(` ${c.white}${title}${c.reset}`); names.forEach(n=> console.log(`  ${c.muted}·${c.reset} ${c.cyan}${n}${c.reset}`)) }); console.log(); return ask() }
      if(t.startsWith("/files")||t.startsWith("/list")){ const p=t.split(" ").slice(1).join(" ").trim()||DESKTOP; try{ const full=resolvePath(p); const ls=fs.readdirSync(full).slice(0,40).map(f=>{ try{ const s=fs.statSync(path.join(full,f)); return `${s.isDirectory()?c.cyan+"dir"+c.reset:"file"}  ${f}  ${c.muted}${s.size}b${c.reset}` }catch{ return f} }); console.log(`\n${c.muted}${full}${c.reset}`); ls.slice(0,20).forEach(x=> console.log(` ${c.muted}·${c.reset} ${x}`)); console.log() }catch(e){ console.log(`${c.red}${e.message}${c.reset}\n`)} return ask() }
      if(t.startsWith("/read ")){ try{ const f=resolvePath(t.slice(6).trim()); const txt=fs.readFileSync(f,"utf-8"); console.log(`\n${c.muted}${f} • ${txt.length} chars${c.reset}`); console.log(`${c.border}─${c.reset}`); console.log(txt.slice(0,6000)); console.log() }catch(e){ console.log(`${c.red}${e.message}${c.reset}\n`)} return ask() }
      if(t.startsWith("/write ")){ const m=t.match(/^\/write\s+(\S+)\s+([\s\S]+)/); if(!m){ console.log(`${c.muted}/write <dosya> <içerik>${c.reset}\n`); return ask()} const f=resolvePath(m[1]); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,m[2],"utf-8"); console.log(`${c.green}yazıldı${c.reset} ${c.muted}${f}${c.reset}\n`); return ask() }
      if(t.startsWith("/web ")){ const q=t.slice(5).trim(); console.log(`${c.muted}aranıyor · ${q}${c.reset}`); const r=await executeTool("web_search",{query:q}); console.log(r+"\n"); return ask() }
      if(t.startsWith("/vision ")){
        const parts=t.slice(8).trim().split(" "); const ip=parts[0], q=parts.slice(1).join(" ")||"Bu gorselde ne var?"; if(!fs.existsSync(ip)&&!fs.existsSync(resolvePath(ip))){ console.log(`${c.red}dosya yok${c.reset}\n`); return ask() }
        const real=fs.existsSync(ip)?ip:resolvePath(ip); const b64=await imageToBase64(real); history.push({role:"user", content:q, images:[b64]})
        console.log(`\n${c.green}agent${c.reset} ${c.muted}· ${config.model}${c.reset}`); console.log(hrDim())
        const s=Date.now(); try{ const r=await streamChat(history,{}); history.push({role:"assistant", content:r.content}); save(); if(r.content.match(/```/)) lastCode=r.content.match(/```[\s\S]*?```/)?.[0]||""; console.log(`${hrDim()}\n${c.muted}${((Date.now()-s)/1000).toFixed(1)}s • ${r.content.length} chars${c.reset}\n`); footer(used(),config.numCtx) }catch(e){ console.log(`${c.red}${e.message}${c.reset}\n`)} return ask()
      }
      if(t==="/copy"){ if(!lastCode){ console.log(`${c.muted}kopyalanacak kod yok${c.reset}\n`); return ask()} try{ if(process.platform==="win32"){ const p=spawn("clip",[],{stdio:["pipe","ignore","ignore"]}); p.stdin.write(lastCode); p.stdin.end(); console.log(`${c.green}panoya kopyalandı${c.reset}\n`)} else exec(`echo ${JSON.stringify(lastCode)} | pbcopy`,()=> console.log(`${c.green}kopyalandı${c.reset}\n`)) }catch{} return ask() }
      if(t==="/ui"){ console.log(`${c.cyan}web açılıyor ${WEB_URL}${c.reset}`); exec(process.platform==="win32"?`start "" "${WEB_URL}"`:`open "${WEB_URL}"`,()=>{}); return ask() }

      let userContent=t
      if(t.startsWith("/code ")) userContent=`/think Kod yaz: ${t.slice(6)}`
      else if(t.startsWith("/math ")) userContent=`/think Matematik coz: ${t.slice(6)}`
      else if(config.think && !userContent.startsWith("/think")) userContent="/think "+userContent
      if(config.smith && !userContent.includes("[Smith")) userContent+=" [Smith Otonom: 3-faz, hata olursa duzelt]"

      history.push({role:"user", content:userContent}); save()
      // opencode tarzı mesaj: kullanıcı sol çubukla
      console.log(`\n${c.cyan}›${c.reset} ${c.white}${t.slice(0,W()-4)}${c.reset}`)
      console.log(`\n${c.green}agent${c.reset} ${c.muted}· ${config.model}${c.reset}`)
      console.log(hrDim())
      const s=Date.now()
      let loop=[...history], iter=0
      try{
        while(iter<5){
          iter++
          const r=await streamChat(loop,{})
          if(r.toolCalls.length===0){
            const m=r.content.match(/```[\s\S]*?```/); if(m) lastCode=m[0]
            history.push({role:"assistant", content:r.content, thinking:r.thinking}); save()
            console.log(`${hrDim()}\n${c.muted}${((Date.now()-s)/1000).toFixed(1)}s • ${r.content.length} chars • iter ${iter}${c.reset}`)
            footer(used(),config.numCtx); console.log(); break
          }
          // opencode'daki gibi araçlar: muted bullet, kutu yok
          console.log(`\n${c.muted}· araçlar · iter ${iter} · ${r.toolCalls.length} çağrı${c.reset}`)
          loop.push({role:"assistant", content:r.content||"", tool_calls:r.toolCalls})
          for(const tc of r.toolCalls){
            const name=tc.function.name, args=typeof tc.function.arguments==="string"? JSON.parse(tc.function.arguments):tc.function.arguments
            console.log(`  ${c.cyan}${name}${c.reset} ${c.muted}${JSON.stringify(args).slice(0,W()-20)}${c.reset}`)
            const out=await executeTool(name,args)
            const preview=String(out).slice(0,W()-10).replace(/\n/g," ")
            console.log(`  ${c.muted}↳ ${preview}${c.reset}`)
            loop.push({role:"tool", content:String(out)})
          }
          console.log(`${c.muted}  … değerlendiriliyor${c.reset}`)
          if(iter===5) break
        }
        if(iter>1){ if(loop.length>history.length) history=[...loop]; save() }
      }catch(e){ console.log(`${c.red}${e.message}${c.reset}\n`) }
      ask()
    })
  }
  ask()
}
main()
