#!/usr/bin/env bun
// Qwen35-Agent Advanced TUI — opencode tarzı, kutucuk (-┌) yok, web gibi tasarım alanı
// Çalıştır: bun run --conditions=browser tui-advanced.tsx  veya  npm run tui
import { createCliRenderer, RGBA } from "@opentui/core"
import { render, useTerminalDimensions, useRenderer, useKeyboard } from "@opentui/solid"
import { createSignal, createEffect, For, Show, onMount, batch } from "solid-js"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

// ── Config ──
const MODEL_DEFAULT = "qwen35-agent"
const BASE_URL = "http://127.0.0.1:11434"
const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"
const HISTORY_FILE = path.join(DESKTOP, ".qwen35-history.json")
const CONFIG_FILE = path.join(DESKTOP, ".qwen35-config.json")

let cfg: any = { model: MODEL_DEFAULT, think: false, smith: true, numCtx: 32768, temp: 0.7 }
try { if (fs.existsSync(CONFIG_FILE)) cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_FILE,"utf-8")) } } catch {}
const saveCfg = () => { try{ fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg,null,2)) }catch{} }

// ── Theme (opencode.json dark) ──
const theme = {
  background: RGBA.fromHex("#0a0a0a"),
  backgroundPanel: RGBA.fromHex("#141414"),
  backgroundElement: RGBA.fromHex("#1e1e1e"),
  backgroundHover: RGBA.fromHex("#282828"),
  border: RGBA.fromHex("#484848"),
  borderSubtle: RGBA.fromHex("#3c3c3c"),
  text: RGBA.fromHex("#eeeeee"),
  textMuted: RGBA.fromHex("#808080"),
  textDim: RGBA.fromHex("#606060"),
  primary: RGBA.fromHex("#fab283"),
  accent: RGBA.fromHex("#9d7cd8"),
  success: RGBA.fromHex("#7fd88f"),
  error: RGBA.fromHex("#e06c75"),
  warning: RGBA.fromHex("#f5a742"),
  info: RGBA.fromHex("#56b6c2"),
}

// ── Tools (15) ──
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

function resolvePath(p:string){
  if(!p) return p
  if(/^[A-Za-z]:[\\/]/.test(p)) return path.normalize(p)
  const n=p.replace(/\//g,"\\")
  if(n.toLowerCase().startsWith("desktop\\")||n.toLowerCase()==="desktop"){ const rel=n.replace(/^desktop[\\/]?/i,""); return rel? path.join(DESKTOP,rel):DESKTOP }
  if(!n.includes("\\")&&!n.includes(":")) return path.join(DESKTOP,n)
  return path.join(DESKTOP, path.basename(n))
}
async function executeTool(name:string, args:any){
  try{
    if(typeof args==="string"){ try{ args=JSON.parse(args)}catch{ args={}} }
    if(name==="write_file"){ const f=resolvePath(args.path); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,args.content??"","utf-8"); return `written ${f} (${(args.content||"").length} bytes)` }
    if(name==="read_file"){ const f=resolvePath(args.path); const t=fs.readFileSync(f,"utf-8"); const off=args.offset||1, lim=args.limit||60; const ls=t.split("\n"); const s=Math.max(0,off-1); return `File: ${f} (${ls.length} lines)\n`+ls.slice(s,s+lim).map((l:string,i:number)=>`${String(s+i+1).padStart(4," ")}  ${l}`).join("\n") }
    if(name==="list_files"){ const f=resolvePath(args.path||DESKTOP); return fs.readdirSync(f).slice(0,60).join("\n") }
    if(name==="edit_file"){ const f=resolvePath(args.path); const t=fs.readFileSync(f,"utf-8"); if(!t.includes(args.old_string)) throw new Error("old_string bulunamadi"); fs.writeFileSync(f,t.replace(args.old_string,args.new_string),"utf-8"); return `edited ${f}` }
    if(name==="delete_file"){ const f=resolvePath(args.path); const s=fs.statSync(f); if(s.isDirectory()) fs.rmdirSync(f); else fs.unlinkSync(f); return `deleted ${f}` }
    if(name==="create_directory"){ const f=resolvePath(args.path); fs.mkdirSync(f,{recursive:true}); return `created ${f}` }
    if(name==="search_files"){ const pat=args.pattern, dir=resolvePath(args.path||DESKTOP), re=new RegExp(pat,"i"); const out:string[]=[]; (function walk(d:string,depth=0){ if(depth>3||out.length>=30) return; for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(out.length>=30) break; if(e.name.startsWith(".")||e.name==="node_modules") continue; const full=path.join(d,e.name); if(e.isDirectory()) try{walk(full,depth+1)}catch{} else try{ const txt=fs.readFileSync(full,"utf-8"); txt.split("\n").forEach((ln,i)=>{ if(re.test(ln)&&out.length<30) out.push(`${full}:${i+1}: ${ln.trim().slice(0,120)}`) })}catch{} } })(dir); return out.length? out.join("\n") : `no matches` }
    if(name==="move_file"){ const s=resolvePath(args.source), d=resolvePath(args.destination); fs.mkdirSync(path.dirname(d),{recursive:true}); fs.renameSync(s,d); return `moved ${s} -> ${d}` }
    if(name==="run_python"){ return await new Promise(r=>{ const p=spawn("python",["-c",args.code],{timeout:15000}); let o="",e=""; p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>e+=d); p.on("close",c=>r((o||"")+(e?"\n"+e:"")+" (exit "+c+")")) }) }
    if(name==="run_javascript"){ return await new Promise(r=>{ const p=spawn("node",["-e",args.code],{timeout:10000}); let o="",e=""; p.stdout.on("data",d=>o+=d); p.stderr.on("data",d=>e+=d); p.on("close",c=>r((o||"")+(e?"\n"+e:"")+" (exit "+c+")")) }) }
    if(name==="run_bash"){ const {exec}=await import("node:child_process"); const {promisify}=await import("node:util"); const ea=promisify(exec); const {stdout,stderr}=await ea(args.command,{timeout:10000}); return (stdout||"")+(stderr?"\n"+stderr:"") }
    if(name==="fetch_url"){ const r=await fetch(args.url,{headers:{"User-Agent":"Mozilla/5.0"}}); if(!r.ok) throw new Error("HTTP "+r.status); const t=await r.text(); return t.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,8000) }
    if(name==="get_system_info"){ const os=await import("node:os"); let m="yok"; try{ const r=await fetch("http://127.0.0.1:11434/api/tags"); const j:any=await r.json(); m=j.models.map((x:any)=>x.name).join(", ")}catch{}; return `${os.platform()} ${os.arch()} • ${m}` }
    if(name==="web_search"){ try{ const r=await fetch("http://127.0.0.1:5173/api/web-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:args.query})}); if(r.ok){ const j:any=await r.json(); if(j.ok&&j.results.length) return j.results.map((x:any,i:number)=>`${i+1}. ${x.title}\n   ${x.url}`).join("\n\n") } }catch{}; return "no results" }
    return "unknown tool "+name
  }catch(e:any){ return "tool error "+e.message }
}

// ── App ──
function App(){
  const dims = useTerminalDimensions()
  const renderer = useRenderer()
  const [messages, setMessages] = createSignal<Array<{role:"user"|"assistant"|"tool", content:string, thinking?:string, tool?:string}>>([])
  const [input, setInput] = createSignal("")
  const [streaming, setStreaming] = createSignal(false)
  const [thinkOn, setThinkOn] = createSignal(cfg.think)
  const [model, setModel] = createSignal(cfg.model)
  const [status, setStatus] = createSignal("hazır • /help ile komutlar")
  const [ctxUsed, setCtxUsed] = createSignal(0)

  // history yükle
  onMount(()=>{
    try{
      if(fs.existsSync(HISTORY_FILE)){
        const h = JSON.parse(fs.readFileSync(HISTORY_FILE,"utf-8"))
        if(Array.isArray(h)) setMessages(h.slice(-40).map((m:any)=> ({role:m.role, content:m.content, thinking:m.thinking})))
      }
    }catch{}
  })
  createEffect(()=>{
    const used = messages().reduce((a,m)=> a + Math.ceil(m.content.length/4) + (m.thinking? Math.ceil(m.thinking.length/4):0), 0)
    setCtxUsed(used)
  })

  const submit = async (raw?:string)=>{
    const text = (raw ?? input()).trim()
    if(!text || streaming()) return
    // komutlar
    if(text==="/clear"){ setMessages([]); setInput(""); try{ fs.writeFileSync(HISTORY_FILE,"[]")}catch{}; setStatus("temizlendi"); return }
    if(text==="/think"){ setThinkOn(true); cfg.think=true; saveCfg(); setStatus("thinking açık"); setInput(""); return }
    if(text==="/no_think"){ setThinkOn(false); cfg.think=false; saveCfg(); setStatus("thinking kapalı"); setInput(""); return }
    if(text==="/help"){ setMessages(m=> [...m, {role:"assistant", content:"Komutlar: /clear  /think  /no_think  /model qwen3.5:9b  /ctx 32K  /tools  — doğrudan mesaj yaz ve Enter"}]); setInput(""); return }
    if(text.startsWith("/model")){ const arg=text.slice(6).trim(); if(arg){ cfg.model=arg; setModel(arg); saveCfg(); setStatus("model → "+arg)}; setInput(""); return }

    let userContent = text
    if(thinkOn() && !userContent.startsWith("/think")) userContent="/think "+userContent
    if(cfg.smith && !userContent.includes("[Smith")) userContent+=" [Smith Otonom]"

    const userMsg = {role:"user" as const, content: text}
    setMessages(m=> [...m, userMsg])
    setInput("")
    setStreaming(true)
    setStatus("yazıyor…")

    // scroll için bir sonraki tick
    const historyForApi = [...messages().slice(0,-1), {role:"user", content: userContent}]

    try{
      // tool loop
      let loopMsgs:any[] = historyForApi.map(m=> ({role:m.role, content:m.content}))
      let iter=0
      let finalContent=""
      let finalThinking=""
      while(iter<5){
        iter++
        const body:any = { model: model(), messages: loopMsgs, stream: true, options:{ num_ctx: cfg.numCtx, temperature: cfg.temp }, tools: TOOLS }
        const res = await fetch(`${BASE_URL}/api/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)})
        if(!res.ok) throw new Error(await res.text())
        const reader = (res.body as any).getReader()
        const dec = new TextDecoder()
        let buf="", accContent="", accThinking="", toolCalls:any[]=[]
        // streaming için ara mesaj ekle
        const assistantIdx = messages().length
        setMessages(m=> [...m, {role:"assistant", content:"", thinking:""}])
        while(true){
          const {done, value} = await reader.read(); if(done) break
          buf+=dec.decode(value,{stream:true})
          const lines=buf.split("\n"); buf=lines.pop()||""
          for(const line of lines){
            if(!line.trim()) continue
            try{
              const ch=JSON.parse(line)
              if(ch.message?.thinking){ accThinking+=ch.message.thinking; setMessages(prev=> prev.map((mm,ii)=> ii===assistantIdx ? {...mm, thinking: accThinking} : mm)) }
              if(ch.message?.content){ accContent+=ch.message.content; setMessages(prev=> prev.map((mm,ii)=> ii===assistantIdx ? {...mm, content: accContent} : mm)) }
              if(ch.message?.tool_calls) toolCalls=ch.message.tool_calls
            }catch{}
          }
        }
        if(buf.trim()){
          try{ const ch=JSON.parse(buf); if(ch.message?.thinking) accThinking+=ch.message.thinking; if(ch.message?.content) accContent+=ch.message.content; if(ch.message?.tool_calls) toolCalls=ch.message.tool_calls; setMessages(prev=> prev.map((mm,ii)=> ii===assistantIdx ? {...mm, content: accContent, thinking: accThinking} : mm)) }catch{}
        }
        finalContent=accContent
        finalThinking=accThinking
        if(toolCalls.length===0) break
        // tool var
        setMessages(m=> [...m.slice(0,assistantIdx), {...m[assistantIdx], content: accContent, thinking: accThinking}, ...toolCalls.map((tc:any)=> ({role:"tool" as const, content:`${tc.function.name} → ${JSON.stringify(tc.function.arguments).slice(0,80)}`, tool: tc.function.name}))])
        // tool çalıştır
        const toolResults:string[]=[]
        for(const tc of toolCalls){
          const args = typeof tc.function.arguments==="string" ? JSON.parse(tc.function.arguments) : tc.function.arguments
          const out = await executeTool(tc.function.name, args)
          toolResults.push(out)
          setMessages(m=> [...m, {role:"tool", content: out.slice(0,800), tool: tc.function.name}])
        }
        loopMsgs.push({role:"assistant", content: accContent, tool_calls: toolCalls})
        for(let i=0;i<toolCalls.length;i++) loopMsgs.push({role:"tool", content: toolResults[i]})
        // bir sonraki iterasyon için son assistant'ı güncelleme — yeni stream gelecek
        // mevcut streaming assistant'ı koru, yeni iter için yeni boş assistant eklenecek döngü başında
        if(iter===5) break
      }
      // history kaydet
      try{ const toSave = messages().slice(-60); fs.writeFileSync(HISTORY_FILE, JSON.stringify(toSave,null,2)) }catch{}
      setStatus(`bitti • ${finalContent.length} chars • iter ${iter} • ctx ${ctxUsed()}/${cfg.numCtx}`)
    }catch(e:any){
      setMessages(m=> [...m, {role:"assistant", content: "❌ hata: "+e.message}])
      setStatus("hata")
    }finally{
      setStreaming(false)
    }
  }

  // Klavye: Enter gönder, Ctrl+C çık, Ctrl+L temizle
  useKeyboard((evt)=>{
    if(evt.ctrl && evt.name==="c"){ renderer.destroy(); process.exit(0) }
    if(evt.ctrl && evt.name==="l"){ setMessages([]); setStatus("temizlendi") }
  })

  // genişlik duyarlı
  const isWide = ()=> dims().width > 110

  return (
    <box width={dims().width} height={dims().height} backgroundColor={theme.background} flexDirection="column">
      {/* Header — opencode gibi, kutu yok, sadece renk blokları */}
      <box height={3} backgroundColor={theme.backgroundPanel} flexDirection="row" alignItems="center" paddingLeft={2} paddingRight={2} justifyContent="space-between">
        <box flexDirection="row" gap={2} alignItems="center">
          <text fg={theme.accent}><span style={{bold:true}}>⬢ qwen35-agent</span></text>
          <text fg={theme.textMuted}>·</text>
          <text fg={theme.text}>{model()}</text>
          <text fg={theme.textMuted}>·</text>
          <text fg={thinkOn()? theme.success : theme.textMuted}>{thinkOn()? "● thinking":"○ thinking"}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={theme.textMuted}>{ctxUsed()}/{cfg.numCtx}</text>
          <text fg={theme.primary}>{streaming()? "● yazıyor":"○ hazır"}</text>
        </box>
      </box>

      {/* Ana alan: mesajlar + (opsiyonel) yan bilgi — opencode'daki gibi responsive */}
      <box flexDirection="row" flexGrow={1}>
        {/* Mesaj alanı — web'deki chat gibi */}
        <box flexGrow={1} flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1}>
          <scrollbox flexGrow={1} stickyScroll={true} stickyStart="bottom" scrollbarOptions={{visible:false}}>
            <box flexDirection="column" gap={1}>
              <Show when={messages().length===0}>
                <box flexDirection="column" gap={1} paddingTop={2} alignItems="center">
                  <text fg={theme.accent}><span style={{bold:true}}>Qwen35-Agent'a hoş geldin</span></text>
                  <text fg={theme.textMuted}>Vision · Thinking · 256K · Tools — opencode tarzı TUI</text>
                  <box flexDirection="row" gap={1} marginTop={1} flexWrap="wrap" justifyContent="center">
                    <box backgroundColor={theme.backgroundElement} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}><text fg={theme.textMuted}>/think ile derin düşünme</text></box>
                    <box backgroundColor={theme.backgroundElement} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}><text fg={theme.textMuted}>/clear temizler</text></box>
                    <box backgroundColor={theme.backgroundElement} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}><text fg={theme.textMuted}>/model değiştirir</text></box>
                  </box>
                </box>
              </Show>
              <For each={messages()}>
                {(m)=> (
                  <Show when={m.role==="user"} fallback={
                    <Show when={m.role==="tool"} fallback={
                      /* assistant */
                      <box flexDirection="column" gap={0}>
                        <Show when={m.thinking}>
                          <box border={["left"]} borderColor={theme.borderSubtle} paddingLeft={2} marginBottom={1}>
                            <text fg={theme.textMuted}><span style={{italic:true}}>{m.thinking}</span></text>
                          </box>
                        </Show>
                        <box paddingLeft={1}>
                          <text fg={theme.text}>{m.content || (streaming()? "…":"")}</text>
                        </box>
                        <box flexDirection="row" gap={1} marginTop={1}>
                          <text fg={theme.success}>▣</text>
                          <text fg={theme.textMuted}>assistant · {model()}</text>
                        </box>
                      </box>
                    }>
                      {/* tool */}
                      <box flexDirection="row" gap={1} backgroundColor={theme.backgroundPanel} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
                        <text fg={theme.warning}>›</text>
                        <text fg={theme.textMuted}>{m.tool}</text>
                        <text fg={theme.text}>{m.content.slice(0, 120)}</text>
                      </box>
                    </Show>
                  }>
                    {/* user — opencode'daki gibi sol border + panel */}
                    <box border={["left"]} borderColor={theme.accent} backgroundColor={theme.backgroundPanel} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
                      <text fg={theme.text}>{m.content}</text>
                    </box>
                  </Show>
                )}
              </For>
              <box height={1} />
            </box>
          </scrollbox>
        </box>

        {/* Yan panel — geniş ekranda göster, darda gizle (opencode responsive gibi) */}
        <Show when={isWide()}>
          <box width={28} backgroundColor={theme.backgroundPanel} flexDirection="column" padding={1} gap={1}>
            <text fg={theme.textMuted}><span style={{bold:true}}>bilgi</span></text>
            <box height={1} backgroundColor={theme.borderSubtle} />
            <box flexDirection="column" gap={1}>
              <box flexDirection="row" justifyContent="space-between"><text fg={theme.textMuted}>model</text><text fg={theme.text}>{model()}</text></box>
              <box flexDirection="row" justifyContent="space-between"><text fg={theme.textMuted}>context</text><text fg={theme.text}>{ctxUsed()}/{cfg.numCtx}</text></box>
              <box flexDirection="row" justifyContent="space-between"><text fg={theme.textMuted}>temp</text><text fg={theme.text}>{String(cfg.temp)}</text></box>
              <box flexDirection="row" justifyContent="space-between"><text fg={theme.textMuted}>tools</text><text fg={theme.text}>15</text></box>
            </box>
            <box height={1} backgroundColor={theme.borderSubtle} marginTop={1} />
            <text fg={theme.textMuted}>kısayollar</text>
            <text fg={theme.textDim}>enter gönder</text>
            <text fg={theme.textDim}>ctrl+l temizle</text>
            <text fg={theme.textDim}>ctrl+c çık</text>
            <text fg={theme.textMuted} marginTop={1}>durum</text>
            <text fg={theme.info}>{status()}</text>
          </box>
        </Show>
      </box>

      {/* Input alanı — web'deki composer gibi, kutu yok, sadece arka plan + sol renk çubuğu */}
      <box height={6} flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={1}>
        <box flexGrow={1} backgroundColor={theme.backgroundElement} border={["left"]} borderColor={theme.accent} paddingLeft={2} paddingRight={2} flexDirection="row" alignItems="center">
          <box flexGrow={1} flexDirection="column">
            <textarea
              focusedTextColor={theme.text}
              textColor={theme.text}
              placeholder={"Mesaj yaz…  (enter gönder • /think ile düşünme aç)"}
              placeholderColor={theme.textMuted}
              backgroundColor={theme.backgroundElement}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.accent}
              value={input()}
              onContentChange={(v:string)=> setInput(v)}
              onSubmit={()=> submit()}
              maxHeight={4}
              minHeight={1}
              flexGrow={1}
            />
          </box>
          <box marginLeft={2} backgroundColor={streaming()? theme.textMuted : theme.accent} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} onMouseUp={()=> submit()}>
            <text fg={theme.background}><span style={{bold:true}}>{streaming()? "…":"▶"}</span></text>
          </box>
        </box>
        <box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <text fg={theme.textMuted}>enter gönder • shift+enter satır • /help komutlar</text>
          <text fg={theme.textMuted}>{status()}</text>
        </box>
      </box>
    </box>
  )
}

// ── Renderer ──
const renderer = await createCliRenderer({
  targetFps: 60,
  useKittyKeyboard: {},
  useMouse: true,
  exitOnCtrlC: false,
})
await render(()=><App/>, renderer)
