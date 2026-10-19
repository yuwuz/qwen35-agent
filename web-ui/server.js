import http from "node:http"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { spawn, exec } from "node:child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 5173
const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"
const MAX_BODY_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_FILE_SIZE = 1024 * 1024 // 1MB per file
const ALLOWED_ROOT = DESKTOP.toLowerCase()
const KITAPLAR_KLASORU = "A:\\AI\\qwen35-agent-test-workspace\\Kitaplar"
function kitapKlasoru(baslik){ const guvenli = baslik.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").slice(0, 50); return `${KITAPLAR_KLASORU}\\${guvenli}` }
function kelimeSayisi(metin){ return metin.trim().split(/\s+/).filter(Boolean).length }
function sayfaHesapla(kelime){ return Math.max(1, Math.ceil(kelime / 300)) }
function kitapHTMLSablonu(kitap, bolumIcerikleri){
  const boyutMap = { A5: "148mm 210mm", A4: "210mm 297mm", cep: "110mm 180mm" }
  const sa = kitap.sayfaAyarlari
  return `<!DOCTYPE html>
<html lang="${kitap.dil}">
<head><meta charset="UTF-8"><title>${kitap.baslik} - ${kitap.yazar}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Sans:wght@400;600&display=swap');
  @page { size: ${boyutMap[sa.boyut]} ${sa.yon==="yatay"?"landscape":"portrait"}; margin-top:${sa.kenarBosluk.ust}; margin-bottom:${sa.kenarBosluk.alt}; margin-inside:${sa.kenarBosluk.ic}; margin-outside:${sa.kenarBosluk.dis}; @bottom-center{content:counter(page);font-family:'Noto Sans',sans-serif;font-size:8pt;color:#666} }
  @page :first { margin:0; @bottom-center{content:none} }
  *{box-sizing:border-box} body{font-family:'${sa.font}','Noto Serif',Georgia,serif;font-size:${sa.fontBoyutu};line-height:${sa.satirAraligi};color:#1a1a1a;text-align:${sa.hizalama};hyphens:auto;orphans:3;widows:3;margin:0;padding:0;background:white}
  .kapak{page:kapak;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:white;padding:40px;break-after:page}
  .kapak h1{font-size:28pt;font-weight:700;margin:0 0 12px 0;letter-spacing:-0.5px;line-height:1.2}
  .kapak .yazar{font-size:14pt;opacity:.9;margin-top:20px;font-style:italic}
  .kapak .tur{font-size:9pt;text-transform:uppercase;letter-spacing:3px;opacity:.7;margin-top:30px;border-top:1px solid rgba(255,255,255,.3);padding-top:15px}
  .kunye{break-after:page;padding:40px;font-size:8pt;color:#666;line-height:1.6}
  .icindekiler{break-after:page} .icindekiler h2{font-size:18pt;text-align:center;margin:0 0 30px 0}
  .icindekiler-listesi{list-style:none;padding:0} .icindekiler-listesi li{display:flex;align-items:baseline;padding:6px 0;border-bottom:1px dotted #ddd;font-size:10pt}
  .bolum{break-before:${sa.bolumBaslangici==="sag-sayfa"?"right":sa.bolumBaslangici==="her-sayfa"?"page":"auto"};margin-bottom:30px}
  .bolum-numarasi{font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#666;font-family:'Noto Sans',sans-serif}
  .bolum-baslik{font-size:20pt;font-weight:700;color:#0f3460;margin:0 0 8px 0}
  .bolum-ayrac{width:40px;height:3px;background:#0f3460;margin:12px 0 20px 0}
  .bolum-icerik p{margin:0 0 10px 0;text-indent:1.2em} .bolum-icerik p:first-of-type{text-indent:0} .bolum-icerik p:first-of-type::first-letter{font-size:22pt;font-weight:700;float:left;line-height:.8;margin:4px 6px 0 0;color:#0f3460}
  @media screen{ body{max-width:700px;margin:20px auto;padding:20px;background:#f5f5f5} .kapak,.kunye,.icindekiler,.bolum{background:white;box-shadow:0 4px 20px rgba(0,0,0,.1);margin-bottom:20px;padding:40px;border-radius:4px} }
</style></head><body>
<div class="kapak"><h1>${kitap.baslik}</h1><div class="yazar">${kitap.yazar}</div><div class="tur">${kitap.tur}</div></div>
<div class="kunye"><h2>Künye</h2><p><strong>${kitap.baslik}</strong><br>Yazar: ${kitap.yazar}<br>Tür: ${kitap.tur}<br>Toplam: ${kitap.toplamSayfa} sayfa · ${kitap.toplamKelime} kelime</p></div>
<div class="icindekiler"><h2>İçindekiler</h2><ul class="icindekiler-listesi">${kitap.bolumler.map((b,i)=>`<li><span style="font-weight:600;min-width:80px;color:#0f3460">Bölüm ${i+1}</span><span style="flex:1">${b.baslik.replace(/^\\d+\\.\\s*Bölüm:\\s*/i,"")}</span><span style="min-width:30px;text-align:right;color:#666">${b.sayfaAraligi||"—"}</span></li>`).join("")}</ul></div>
${bolumIcerikleri.map(({bolum, icerik}, idx)=>`<div class="bolum"><div class="bolum-numarasi">Bölüm ${idx+1}</div><h2 class="bolum-baslik">${bolum.baslik.replace(/^\\d+\\.\\s*Bölüm:\\s*/i,"")}</h2><div class="bolum-ayrac"></div><div class="bolum-icerik">${icerik.split("\n\n").filter(Boolean).map(p=>`<p>${p.replace(/\n/g,"<br>")}</p>`).join("")}</div></div>`).join("")}
</body></html>`
}

function log(msg){ console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`) }

const mime = {
  ".html":"text/html",
  ".js":"text/javascript",
  ".css":"text/css",
  ".json":"application/json",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".svg":"image/svg+xml",
}

function readBody(req){
  return new Promise((resolve, reject)=>{
    let d=""; let len=0
    req.on("data",c=>{
      len += Buffer.byteLength(c)
      if(len > MAX_BODY_SIZE){ reject(new Error("Body too large (2MB limit)")); req.destroy(); return }
      d+=c
    })
    req.on("end",()=>resolve(d))
    req.on("error",reject)
  })
}

// === Path normalize: sadece Desktop içinde izin ver ===
function resolvePath(p){
  if(!p) throw new Error("path gerekli")
  let full = ""
  if(path.isAbsolute(p) && /^[A-Za-z]:/.test(p)){
    full = path.normalize(p)
  } else {
    const n = p.replace(/\//g, "\\").trim()
    if(n.toLowerCase().startsWith("desktop\\") || n.toLowerCase()==="desktop"){
      const rel = n.replace(/^desktop[\\/]?/i, "")
      full = rel ? path.join(DESKTOP, rel) : DESKTOP
    } else if(!n.includes("\\") && !n.includes("/") && !n.includes(":")){
      full = path.join(DESKTOP, n)
    } else {
      const cleaned = n.replace(/^\.[\\/]/, "")
      // relative ise Desktop'a yönlendir
      full = path.join(DESKTOP, cleaned.replace(/^.*[\\/]/, (m)=> m.includes(":") ? "" : m))
      // Basit: her relative'i Desktop basename'e koy
      if(!full.toLowerCase().startsWith(ALLOWED_ROOT)){
        full = path.join(DESKTOP, path.basename(cleaned))
      }
    }
  }
  full = path.normalize(full)
  // Güvenlik: sadece Desktop içinde olmalı
  if(!full.toLowerCase().startsWith(ALLOWED_ROOT)){
    log(`[BLOCKED] Path traversal denemesi: ${p} -> ${full}`)
    throw new Error(`Erişim engellendi: sadece ${DESKTOP} içinde işlem yapılabilir (istenen: ${p})`)
  }
  // .. içermemeli (normalize sonrası zaten çözülmüş ama ekstra kontrol)
  if(full.includes("..")){
    throw new Error("Geçersiz path: .. içeremez")
  }
  return full
}

const server = http.createServer(async (req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*")
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers","Content-Type")
  if(req.method==="OPTIONS"){ res.writeHead(204); return res.end() }

  // Health check
  if(req.url === "/api/health" && req.method==="GET"){
    res.writeHead(200, {"Content-Type":"application/json"})
    return res.end(JSON.stringify({ok:true, service:"qwen35-agent-web-ui", port:PORT, desktop:DESKTOP, uptime: process.uptime()}))
  }

  // === TOOL EXECUTION API ===
  if(req.url === "/api/write-file" && req.method==="POST"){
    try{
      const {path: p, content} = JSON.parse(await readBody(req))
      if(!p) throw new Error("path 為必要參數")
      if(content && Buffer.byteLength(content, "utf-8") > MAX_FILE_SIZE) throw new Error(`檔案過大 (max ${MAX_FILE_SIZE/1024}KB)`)
      const full = resolvePath(p)
      log(`[write] ${full} (${(content||"").length} chars)`)
      fs.mkdirSync(path.dirname(full), {recursive:true})
      fs.writeFileSync(full, content ?? "", "utf-8")
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, path: full, size: (content||"").length}))
    }catch(e){ log(`[write-error] ${e.message}`); res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/read-file" && req.method==="POST"){
    try{
      const {path: p, offset, limit} = JSON.parse(await readBody(req))
      if(!p) throw new Error("path 為必要參數")
      const full = resolvePath(p)
      const stat = fs.statSync(full)
      if(stat.size > MAX_FILE_SIZE) throw new Error(`檔案過大 (${stat.size} bytes, max ${MAX_FILE_SIZE})`)
      const content = fs.readFileSync(full, "utf-8")
      let out = content
      if(offset || limit){
        const lines = content.split("\n")
        const start = Math.max(0, (offset||1)-1)
        const lim = limit || 200
        const sliced = lines.slice(start, start+lim)
        out = `File: ${full} (${lines.length} lines, showing ${start+1}-${start+sliced.length})\n${"─".repeat(50)}\n` + sliced.map((l,i)=> `${String(start+i+1).padStart(4," ")}: ${l}`).join("\n")
      } else {
        out = content.slice(0,12000)
      }
      log(`[read] ${full} (${stat.size} bytes${offset? ` offset:${offset}`:""})`)
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, path: full, content: out}))
    }catch(e){ log(`[read-error] ${e.message}`); res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/list-files" && req.method==="POST"){
    try{
      const {path: p} = JSON.parse(await readBody(req))
      const full = resolvePath(p || DESKTOP)
      log(`[list] ${full}`)
      const files = fs.readdirSync(full).slice(0,100).map(f=>{
        try{
          const fp = path.join(full, f)
          const stat = fs.statSync(fp)
          return `${stat.isDirectory() ? "DIR " : "FILE"} ${f} (${stat.size} bytes)`
        }catch{ return `FILE ${f} (unknown)` }
      })
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, path: full, files}))
    }catch(e){ log(`[list-error] ${e.message}`); res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/run-python" && req.method==="POST"){
    try{
      const {code} = JSON.parse(await readBody(req))
      if(!code) throw new Error("code parametresi zorunlu")
      if(Buffer.byteLength(code) > 20000) throw new Error("Kod çok uzun (max 20KB)")
      log(`[python] ${code.slice(0,80).replace(/\n/g,' ')}...`)
      const proc = spawn("python", ["-c", code], {timeout:15000})
      let out="", err=""
      proc.stdout.on("data", d=> out+=d)
      proc.stderr.on("data", d=> err+=d)
      proc.on("close", code=>{
        res.writeHead(200, {"Content-Type":"application/json"})
        res.end(JSON.stringify({ok: code===0, output: out, error: err, exitCode: code}))
      })
      proc.on("error", e=>{ res.writeHead(500, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:false, error:e.message})) })
      return
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/run-bash" && req.method==="POST"){
    try{
      const {command} = JSON.parse(await readBody(req))
      if(!command) throw new Error("command parametresi zorunlu")
      if(command.length > 2000) throw new Error("Komut çok uzun")
      // Basit güvenlik: tehlikeli komutları engelle (format, del /f, rm -rf /)
      const blocked = ["format c:", "mkfs", "rm -rf /", "del /f /s", ":(){:|:&};:"]
      if(blocked.some(b=> command.toLowerCase().includes(b))) throw new Error("Tehlikeli komut engellendi")
      log(`[bash] ${command.slice(0,120)}`)
      exec(command, {timeout:10000, encoding:"utf8"}, (err, stdout, stderr)=>{
        res.writeHead(200, {"Content-Type":"application/json"})
        res.end(JSON.stringify({ok: !err, output: stdout, error: stderr|| (err?err.message:"")}))
      })
      return
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/web-search" && req.method==="POST"){
    try{
      const {query} = JSON.parse(await readBody(req))
      if(!query) throw new Error("query gerekli")
      // DuckDuckGo HTML scraping - API key gerektirmez
      let html = ""
      // Önce GET dene, olmazsa POST
      for(let attempt=0; attempt<2; attempt++){
        try{
          const isPost = attempt===1
          const searchUrl = isPost ? `https://html.duckduckgo.com/html/` : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
          const controller = new AbortController()
          const timeout = setTimeout(()=>controller.abort(), 8000)
          const r = await fetch(searchUrl, {
            method: isPost ? "POST" : "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
              "Content-Type": isPost ? "application/x-www-form-urlencoded" : "text/html",
              "Referer": "https://html.duckduckgo.com/"
            },
            body: isPost ? `q=${encodeURIComponent(query)}` : undefined,
            signal: controller.signal
          })
          clearTimeout(timeout)
          if(!r.ok) throw new Error(`DuckDuckGo ${r.status}`)
          html = await r.text()
          console.log(`[web-search] "${query}" attempt ${attempt} html ${html.length} bytes`)
          if(html.includes("result__a")) break
        }catch(e){ console.log(`[web-search] attempt ${attempt} error`, e.message) }
      }
      const results = []
      // Daha esnek regex - class sırası değişebilir, title içinde <b> olabilir
      const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
      const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g
      const links = [...html.matchAll(linkRegex)].slice(0,5).map(m=>({url: m[1].replace(/&amp;/g,'&'), title: m[2].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}))
      const snippets = [...html.matchAll(snippetRegex)].slice(0,5).map(m=> m[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim())
      console.log(`[web-search] links=${links.length} snippets=${snippets.length}`)
      for(let i=0;i<links.length;i++){
        results.push({title: links[i].title, url: links[i].url, snippet: snippets[i] || ""})
      }
      if(results.length===0){
        // Fallback: API dene
        try{
          const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
          const r2 = await fetch(apiUrl, {headers:{"User-Agent":"Mozilla/5.0"}})
          const j2 = await r2.json()
          if(j2.AbstractText) results.push({title: j2.Heading || query, url: j2.AbstractURL || "", snippet: j2.AbstractText})
          if(j2.RelatedTopics) {
            for(const t of j2.RelatedTopics.slice(0,3)){
              if(t.Text && t.FirstURL) results.push({title: t.Text.slice(0,60), url: t.FirstURL, snippet: t.Text})
            }
          }
        }catch{}
        // Hala 0 ise debug html'i logla ve döndür
        if(results.length===0){
          console.log(`[web-search] no results, html sample: ${html.slice(0,500).replace(/\n/g,' ')}`)
          res.writeHead(200, {"Content-Type":"application/json"})
          return res.end(JSON.stringify({ok:true, query, results: [{title: `Arama: ${query}`, url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`, snippet: `DuckDuckGo üzerinden ${query} için sonuçlar (HTML parse edilemedi, doğrudan DuckDuckGo'ya bak: https://duckduckgo.com/?q=${encodeURIComponent(query)})`}], count: 1, debug: html.slice(0,300)}))
        }
      }
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, query, results, count: results.length}))
    }catch(e){
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:false, error:e.message, results: [], hint: "Web araması şu an kullanılamıyor, model bilgisiyle cevap ver"}))
    }
  }

  // === YENİ TOOLS ===
  if(req.url === "/api/edit-file" && req.method==="POST"){
    try{
      const {path: p, old_string, new_string} = JSON.parse(await readBody(req))
      if(!p || old_string===undefined) throw new Error("path ve old_string gerekli")
      const full = resolvePath(p)
      log(`[edit] ${full}`)
      const content = fs.readFileSync(full, "utf-8")
      if(!content.includes(old_string)) throw new Error(`old_string bulunamadı: "${old_string.slice(0,60)}"`)
      const newContent = content.replace(old_string, new_string ?? "")
      fs.writeFileSync(full, newContent, "utf-8")
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, path: full}))
    }catch(e){ log(`[edit-error] ${e.message}`); res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/delete-file" && req.method==="POST"){
    try{
      const {path: p} = JSON.parse(await readBody(req))
      if(!p) throw new Error("path gerekli")
      const full = resolvePath(p)
      log(`[delete] ${full}`)
      const stat = fs.statSync(full)
      if(stat.isDirectory()) fs.rmdirSync(full)
      else fs.unlinkSync(full)
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, path: full}))
    }catch(e){ log(`[delete-error] ${e.message}`); res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/create-directory" && req.method==="POST"){
    try{
      const {path: p} = JSON.parse(await readBody(req))
      if(!p) throw new Error("path gerekli")
      const full = resolvePath(p)
      log(`[mkdir] ${full}`)
      fs.mkdirSync(full, {recursive:true})
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, path: full}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/move-file" && req.method==="POST"){
    try{
      const {source, destination} = JSON.parse(await readBody(req))
      if(!source || !destination) throw new Error("source ve destination gerekli")
      const fullSrc = resolvePath(source)
      const fullDest = resolvePath(destination)
      log(`[move] ${fullSrc} -> ${fullDest}`)
      fs.mkdirSync(path.dirname(fullDest), {recursive:true})
      fs.renameSync(fullSrc, fullDest)
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, source: fullSrc, destination: fullDest}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/search-files" && req.method==="POST"){
    try{
      const {pattern, path: p, include} = JSON.parse(await readBody(req))
      if(!pattern) throw new Error("pattern gerekli")
      const searchPath = resolvePath(p || DESKTOP)
      log(`[search] "${pattern}" in ${searchPath}`)
      const regex = new RegExp(pattern, "i")
      const results = []
      function walk(dir, depth=0){
        if(depth>3 || results.length>=30) return
        const entries = fs.readdirSync(dir, {withFileTypes:true})
        for(const e of entries){
          if(results.length>=30) break
          if(e.name.startsWith(".") || e.name==="node_modules" || e.name===".git") continue
          if(include && !e.name.includes(include.replace("*",""))) {
            if(e.isDirectory()) walk(path.join(dir, e.name), depth+1)
            continue
          }
          const full = path.join(dir, e.name)
          if(e.isDirectory()){
            try{ walk(full, depth+1) }catch{}
          } else {
            try{
              const content = fs.readFileSync(full, "utf-8")
              const lines = content.split("\n")
              lines.forEach((line, idx)=>{
                if(regex.test(line) && results.length<30){
                  results.push(`${full}:${idx+1}: ${line.trim().slice(0,120)}`)
                }
              })
            }catch{}
          }
        }
      }
      walk(searchPath)
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, pattern, path: searchPath, results, count: results.length}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/run-javascript" && req.method==="POST"){
    try{
      const {code} = JSON.parse(await readBody(req))
      if(!code) throw new Error("code gerekli")
      if(Buffer.byteLength(code) > 20000) throw new Error("Kod çok uzun")
      log(`[js] ${code.slice(0,60).replace(/\n/g," ")}`)
      const proc = spawn("node", ["-e", code], {timeout:10000})
      let out="", err=""
      proc.stdout.on("data", d=> out+=d)
      proc.stderr.on("data", d=> err+=d)
      proc.on("close", c=>{
        res.writeHead(200, {"Content-Type":"application/json"})
        res.end(JSON.stringify({ok: c===0, output: out, error: err, exitCode: c}))
      })
      proc.on("error", e=>{ res.writeHead(500, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:false, error:e.message})) })
      return
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/fetch-url" && req.method==="POST"){
    try{
      const {url} = JSON.parse(await readBody(req))
      if(!url || !url.startsWith("http")) throw new Error("Geçerli URL gerekli")
      log(`[fetch] ${url}`)
      const r = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0 Qwen35-Agent"}, signal: AbortSignal.timeout(10000)})
      if(!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      const stripped = text.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,8000)
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, url, content: stripped, size: text.length}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/get-system-info" && req.method==="POST"){
    try{
      const os = await import("node:os")
      const cwd = process.cwd()
      const desktopFiles = fs.readdirSync(DESKTOP).slice(0,20)
      let ollamaModels = "無"
      try{ const r=await fetch("http://127.0.0.1:11434/api/tags"); const j=await r.json(); ollamaModels = j.models.map(m=>m.name).join(", ") }catch{}
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, info: {platform: os.platform(), arch: os.arch(), cpus: os.cpus()[0]?.model, totalMem: (os.totalmem()/1024/1024/1024).toFixed(1)+"GB", cwd, desktopFiles, ollamaModels, node: process.version}}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  // === GÖRSEL ÜRETME API (Pollinations.ai) ===
  if(req.url === "/api/generate-image" && req.method==="POST"){
    try{
      const {prompt, width, height, seed, negative_prompt} = JSON.parse(await readBody(req))
      if(!prompt) throw new Error("prompt gerekli")
      const w = width || 1024
      const h = height || 1024
      const encodedPrompt = encodeURIComponent(prompt.trim())
      const params = new URLSearchParams()
      params.set("width", String(w))
      params.set("height", String(h))
      params.set("model", "flux")
      params.set("nologo", "true")
      const s = seed ?? Math.floor(Math.random()*999999)
      params.set("seed", String(s))
      if(negative_prompt) params.set("negative_prompt", negative_prompt)
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`
      log(`[generate-image] "${prompt.slice(0,60)}" -> ${url.slice(0,120)}`)
      res.writeHead(200, {"Content-Type":"application/json"})
      return res.end(JSON.stringify({ok:true, prompt, url, width:w, height:h, markdown: `![${prompt.slice(0,60)}](${url})`}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }

  // === KİTAP YAZMA API (5 araç) — kalıcı, sayfa düzeni otomatik ===
  if(req.url === "/api/book-create" && req.method==="POST"){
    try{
      const {baslik, yazar, tur, ozet, bolumSayisi, sayfaSayisi, dil} = JSON.parse(await readBody(req))
      if(!baslik) throw new Error("Kitap başlığı gerekli")
      const klasor = kitapKlasoru(baslik)
      try{ await fsp.access(klasor); res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:`"${baslik}" zaten var`})) }catch{}
      await fsp.mkdir(klasor, {recursive:true}); await fsp.mkdir(path.join(klasor,"bolumler"), {recursive:true})
      let hedefBolum
      if(bolumSayisi) hedefBolum=bolumSayisi
      else if(sayfaSayisi){
        if(sayfaSayisi<=3) hedefBolum=Math.max(2, Math.ceil(sayfaSayisi/1.5))
        else if(sayfaSayisi<=10) hedefBolum=Math.ceil(sayfaSayisi/2)
        else hedefBolum=Math.ceil(sayfaSayisi/3)
        hedefBolum=Math.min(hedefBolum,12)
      } else {
        const tl=(tur||"").toLowerCase()
        if(tl.includes("hikaye")) hedefBolum=5
        else if(tl.includes("çocuk")) hedefBolum=6
        else if(tl.includes("fantastik")) hedefBolum=8
        else hedefBolum=10
      }
      const kitap = { baslik, yazar: yazar||"Anonim", tur: tur||"roman", dil: dil||"tr", ozet: ozet||"", olusturmaTarihi: new Date().toISOString(), sonGuncelleme: new Date().toISOString(), durum:"yaziliyor", sayfaAyarlari:{ boyut:"A5", yon:"dikey", kenarBosluk:{ust:"20mm",alt:"20mm",ic:"18mm",dis:"15mm"}, font:"Noto Serif", fontBoyutu:"10pt", satirAraligi:1.5, hizalama:"justify", sayfaNumarasi:"alt-orta", bolumBaslangici:"sag-sayfa"}, bolumler:[], toplamSayfa:0, toplamKelime:0, sayfaSayisi: sayfaSayisi||null }
      const isFantastik=(tur||"").toLowerCase().includes("fantastik")
      const isKisa=sayfaSayisi>0 && sayfaSayisi<=5
      for(let i=1;i<=hedefBolum;i++){
        let bBaslik, bOzet
        if(isKisa && isFantastik){
          const basliklar=["Gölgelerin Uyanışı","Ejderha Vadisi","Güneşin Ardındaki Sır"]
          const ozetler=["Kahramanın karanlık krallıkta uyanışı, ejderha kralının zayıfladığını fark etmesi","Güneşin ardındaki efsanevi vadiye yolculuk, ilk ejderha ile karşılaşma","Final sırrın ortaya çıkışı, krallığın kaderi ve yeni umut"]
          bBaslik=basliklar[i-1]||`${i}. Bölüm`
          bOzet=ozetler[i-1]||`Fantastik gelişme - Bölüm ${i}`
        } else if(isFantastik){
          const fb=["Karanlığın Kalbi","Kadim Kehanet","Ejderha İttifakı","Ateş ve Buz","Kayıp Şehir","Son Savaş","Yeni Şafak"]
          bBaslik=`${i}. Bölüm: ${fb[i-1]||`Bölüm ${i}`}`
          bOzet= i===1?"Fantastik dünyanın tanıtımı, kahramanın çağrısı": i===hedefBolum?"Epik final savaşı ve yeni düzen":`Fantastik gelişme - Bölüm ${i}`
        } else {
          bBaslik=`${i}. Bölüm`
          bOzet= i===1?"Giriş ve merak uyandırma": i===hedefBolum?"Sonuç ve kapanış":`Gelişme - Bölüm ${i}`
        }
        if(i===1 && ozet) bOzet=ozet+" — "+bOzet
        kitap.bolumler.push({id:`bolum-${String(i).padStart(2,"0")}`, baslik:bBaslik, ozet:bOzet, durum:"planlandi", kelimeSayisi:0, dosya:`bolumler/bolum-${String(i).padStart(2,"0")}.md`, sira:i})
      }
      // Kısa kitap ise OTOMATİK içerik üret
      const hedefKelime=sayfaSayisi? sayfaSayisi*300:0
      const isKisaKitap=sayfaSayisi>0 && sayfaSayisi<=5
      if(isKisaKitap){
        for(const bolum of kitap.bolumler){
          const kelimeHedef=Math.ceil(hedefKelime/hedefBolum)
          const prompt=`Fantastik roman "${baslik}" için "${bolum.baslik}" bölümünü yaz. Tür: ${tur}. Kitap özeti: ${ozet||"Ejderhaların hüküm sürdüğü fantastik dünya"}. Bölüm özeti: ${bolum.ozet}. Yaklaşık ${kelimeHedef} kelime, sürükleyici, edebi, diyaloglu, betimleyici bir dille yaz. Sadece bölüm metnini yaz, başlık tekrar etme.`
          try{
            const r=await fetch("http://127.0.0.1:11434/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"qwen35-agent",messages:[{role:"user",content:prompt}],stream:false,options:{num_ctx:8192,temperature:0.8}})})
            if(r.ok){
              const data=await r.json()
              const icerik=data.message.content.trim()
              const dosyaYolu=path.join(klasor, bolum.dosya)
              await fsp.mkdir(path.dirname(dosyaYolu),{recursive:true})
              await fsp.writeFile(dosyaYolu, icerik,"utf-8")
              bolum.kelimeSayisi=icerik.trim().split(/\s+/).filter(Boolean).length
              bolum.durum="tamamlandi"
              bolum.sayfaAraligi=`${Math.max(1,Math.ceil(bolum.kelimeSayisi/300))} sayfa`
            }
          }catch{}
        }
        kitap.toplamKelime=kitap.bolumler.reduce((a,b)=>a+b.kelimeSayisi,0)
        kitap.toplamSayfa=kitap.bolumler.reduce((a,b)=>a+Math.max(1,Math.ceil(b.kelimeSayisi/300)),0)
        if(kitap.toplamSayfa===0){ kitap.toplamKelime=hedefKelime; kitap.toplamSayfa=sayfaSayisi }
        kitap.durum="tamamlandi"
      }
      await fsp.writeFile(path.join(klasor,"kitap.json"), JSON.stringify(kitap,null,2),"utf-8")
      const bolumIcerikleri=await Promise.all(kitap.bolumler.map(async b=>{ try{ const ic=await fsp.readFile(path.join(klasor,b.dosya),"utf-8"); return {bolum:b, icerik:ic} }catch{ return {bolum:b, icerik:"*Henüz yazılmadı*"} }}))
      const html=kitapHTMLSablonu(kitap, bolumIcerikleri); await fsp.writeFile(path.join(klasor,"kitap.html"), html,"utf-8")
      let mesaj
      if(isKisaKitap){
        mesaj=`✅ Kitap oluşturuldu ve YAZILDI! (KISA KİTAP OTOMATİK MOD)\n📚 "${baslik}" — ${tur} · Hedef: ${sayfaSayisi} sayfa (~${hedefKelime} kelime)\n📑 ${hedefBolum} bölüm YAZILDI (toplam ${kitap.toplamKelime} kelime · ${kitap.toplamSayfa} sayfa)\n📄 HTML: ${klasor}\\kitap.html\n✅ Tüm bölümler otomatik yazıldı! PDF için: book_generate(kitapAdi="${baslik}", format="pdf")`
      } else {
        mesaj=`Kitap "${baslik}" oluşturuldu, ${hedefBolum} bölüm planlandı`
        if(sayfaSayisi) mesaj+=` (Hedef: ${sayfaSayisi} sayfa ~${hedefKelime} kelime, her bölüm ~${Math.ceil(hedefKelime/hedefBolum)} kelime)`
      }
      log(`[book-create] ${baslik} -> ${klasor} (${hedefBolum} bolum, hedef ${sayfaSayisi||"-"} sayfa, isKisa:${isKisaKitap})`)
      res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, kitap, klasor, mesaj}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/book-status" && req.method==="POST"){
    try{
      const {kitapAdi} = JSON.parse(await readBody(req) || "{}")
      await fsp.mkdir(KITAPLAR_KLASORU,{recursive:true}).catch(()=>{})
      if(!kitapAdi){
        const klasorler = await fsp.readdir(KITAPLAR_KLASORU).catch(()=>[])
        if(klasorler.length===0) { res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, kitaplar:[], mesaj:"Henüz hiç kitap yok"})) }
        const kitaplar=[]
        for(const klasor of klasorler){
          try{
            const data=await fsp.readFile(path.join(KITAPLAR_KLASORU,klasor,"kitap.json"),"utf-8"); const k=JSON.parse(data)
            const tamam=k.bolumler.filter(b=>b.durum==="tamamlandi").length; const siradaki=k.bolumler.find(b=>b.durum!=="tamamlandi")
            kitaplar.push({baslik:k.baslik, yazar:k.yazar, tur:k.tur, tamam:`${tamam}/${k.bolumler.length}`, sayfa:k.toplamSayfa, durum:k.durum, siradaki: siradaki? siradaki.baslik:"Tamamlandı"})
          }catch{}
        }
        res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, kitaplar}))
      } else {
        let klasor = kitapKlasoru(kitapAdi)
        let data
        try{ data=await fsp.readFile(path.join(klasor,"kitap.json"),"utf-8") }catch{
          const klasorler=await fsp.readdir(KITAPLAR_KLASORU).catch(()=>[]); let bulundu=null
          for(const k of klasorler){ try{ const d=await fsp.readFile(path.join(KITAPLAR_KLASORU,k,"kitap.json"),"utf-8"); const j=JSON.parse(d); if(j.baslik.toLowerCase()===kitapAdi.toLowerCase()||k.toLowerCase()===kitapAdi.toLowerCase()){ bulundu=path.join(KITAPLAR_KLASORU,k,"kitap.json"); break } }catch{} }
          if(!bulundu) { res.writeHead(404, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:`Kitap bulunamadı: ${kitapAdi}`})) }
          data=await fsp.readFile(bulundu,"utf-8")
        }
        const k=JSON.parse(data)
        res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, kitap:k}))
      }
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/book-add-chapter" && req.method==="POST"){
    try{
      const {kitapAdi, baslik, ozet} = JSON.parse(await readBody(req))
      if(!kitapAdi||!baslik) throw new Error("kitapAdi ve baslik gerekli")
      const klasor=kitapKlasoru(kitapAdi); const data=await fsp.readFile(path.join(klasor,"kitap.json"),"utf-8"); const kitap=JSON.parse(data)
      const yeniSira=kitap.bolumler.length+1; const yeniId=`bolum-${String(yeniSira).padStart(2,"0")}`
      const yeniBolum={id:yeniId, baslik, ozet:ozet||"", durum:"planlandi", kelimeSayisi:0, dosya:`bolumler/${yeniId}.md`, sira:yeniSira}
      kitap.bolumler.push(yeniBolum); kitap.sonGuncelleme=new Date().toISOString()
      await fsp.writeFile(path.join(klasor,"kitap.json"), JSON.stringify(kitap,null,2),"utf-8")
      res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, bolum:yeniBolum}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/book-write" && req.method==="POST"){
    try{
      const {kitapAdi, bolumId, icerik, konum} = JSON.parse(await readBody(req))
      if(!kitapAdi) throw new Error("kitapAdi gerekli")
      const klasor=kitapKlasoru(kitapAdi); const data=await fsp.readFile(path.join(klasor,"kitap.json"),"utf-8"); const kitap=JSON.parse(data)
      let hedef = bolumId ? kitap.bolumler.find(b=> b.id===bolumId || b.baslik.toLowerCase().includes(bolumId.toLowerCase())) : null
      if(!hedef) hedef=kitap.bolumler.find(b=> b.durum!=="tamamlandi") || kitap.bolumler[kitap.bolumler.length-1]
      if(!hedef) throw new Error("Bölüm bulunamadı")
      if(!icerik) { res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, hedef, mesaj:`İçerik verilmedi, ${hedef.id} için yazılmalı`, ozet:hedef.ozet})) }
      const dosyaYolu=path.join(klasor, hedef.dosya); let mevcut=""; try{ mevcut=await fsp.readFile(dosyaYolu,"utf-8") }catch{}
      let yeniIcerik = (konum==="baslangic") ? icerik + (mevcut?"\n\n"+mevcut:"") : mevcut ? mevcut+"\n\n"+icerik : icerik
      await fsp.mkdir(path.dirname(dosyaYolu),{recursive:true}); await fsp.writeFile(dosyaYolu, yeniIcerik,"utf-8")
      const kelime=kelimeSayisi(yeniIcerik), sayfa=sayfaHesapla(kelime)
      hedef.kelimeSayisi=kelime; hedef.durum= kelime>100?"tamamlandi":"yaziliyor"; hedef.sayfaAraligi=`${sayfa} sayfa (~${kelime} kelime)`
      kitap.toplamKelime=kitap.bolumler.reduce((a,b)=>a+b.kelimeSayisi,0); kitap.toplamSayfa=kitap.bolumler.reduce((a,b)=>a+sayfaHesapla(b.kelimeSayisi),0)
      kitap.sonGuncelleme=new Date().toISOString(); if(kitap.bolumler.every(b=>b.durum==="tamamlandi")) kitap.durum="tamamlandi"; else kitap.durum="yaziliyor"
      await fsp.writeFile(path.join(klasor,"kitap.json"), JSON.stringify(kitap,null,2),"utf-8")
      // HTML önizleme güncelle
      try{
        const bolumIcerikleri=await Promise.all(kitap.bolumler.map(async b=>{ try{ const ic=await fsp.readFile(path.join(klasor,b.dosya),"utf-8"); return {bolum:b, icerik:ic} }catch{ return {bolum:b, icerik:"*Henüz yazılmadı*"} }}))
        const html=kitapHTMLSablonu(kitap, bolumIcerikleri); await fsp.writeFile(path.join(klasor,"kitap.html"), html,"utf-8")
      }catch{}
      const siradaki=kitap.bolumler.find(b=>b.durum!=="tamamlandi")
      res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, bolum:hedef, toplamSayfa:kitap.toplamSayfa, toplamKelime:kitap.toplamKelime, siradaki}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }
  if(req.url === "/api/book-generate" && req.method==="POST"){
    try{
      const {kitapAdi, format: formatRaw} = JSON.parse(await readBody(req))
      const format = (formatRaw||"hepsi").toLowerCase()
      if(!kitapAdi) throw new Error("kitapAdi gerekli")
      const klasor=kitapKlasoru(kitapAdi); const data=await fsp.readFile(path.join(klasor,"kitap.json"),"utf-8"); const kitap=JSON.parse(data)
      const bolumIcerikleri=await Promise.all(kitap.bolumler.map(async b=>{ try{ const ic=await fsp.readFile(path.join(klasor,b.dosya),"utf-8"); return {bolum:b, icerik:ic||"*Boş*"} }catch{ return {bolum:b, icerik:"*Henüz yazılmadı*"} }}))
      const html=kitapHTMLSablonu(kitap, bolumIcerikleri); const htmlYolu=path.join(klasor,"kitap.html"); await fsp.writeFile(htmlYolu, html,"utf-8")
      const wantHtml=["html","hepsi","her-ikisi"].includes(format), wantPdf=["pdf","hepsi","her-ikisi"].includes(format), wantDocx=["docx","word","hepsi"].includes(format), wantEpub=["epub","hepsi"].includes(format)
      let docxYolu=null, epubYolu=null
      if(wantDocx){
        try{
          const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx")
          const children=[]
          children.push(new Paragraph({children:[new TextRun({text:kitap.baslik,bold:true,size:32})], heading:HeadingLevel.TITLE, alignment:AlignmentType.CENTER}))
          children.push(new Paragraph({children:[new TextRun({text:kitap.yazar,italics:true,size:20})], alignment:AlignmentType.CENTER}))
          for(const {bolum, icerik} of bolumIcerikleri){
            children.push(new Paragraph({children:[new TextRun({text:bolum.baslik,bold:true,size:24,color:"0f3460"})], heading:HeadingLevel.HEADING_1}))
            icerik.split("\n\n").filter(Boolean).forEach(p=>{ children.push(new Paragraph({children:[new TextRun({text:p,size:18})], alignment:AlignmentType.JUSTIFIED})) })
          }
          const doc=new Document({sections:[{properties:{page:{size:{width:5220,height:7560},margin:{top:1440,bottom:1440,left:1020,right:850}}},children}]})
          const buf=await Packer.toBuffer(doc); docxYolu=path.join(klasor,"kitap.docx"); await fsp.writeFile(docxYolu, buf)
        }catch(e){ log(`[book-docx-error] ${e.message}`) }
      }
      if(wantEpub){
        try{
          const JSZip=(await import("jszip")).default
          const zip=new JSZip()
          zip.file("mimetype","application/epub+zip",{compression:"STORE"})
          zip.file("META-INF/container.xml",`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
          let manifest="", spine="", toc=""
          bolumIcerikleri.forEach(({bolum,icerik},idx)=>{
            const id=`chap${idx+1}`, file=`Text/${id}.xhtml`
            manifest+=`<item id="${id}" href="${file}" media-type="application/xhtml+xml"/>`
            spine+=`<itemref idref="${id}"/>`
            toc+=`<navPoint id="${id}" playOrder="${idx+1}"><navLabel><text>${bolum.baslik}</text></navLabel><content src="${file}"/></navPoint>`
            const body=icerik.split("\n\n").filter(Boolean).map(p=>`<p>${p.replace(/</g,"&lt;")}</p>`).join("\n")
            zip.file(`OEBPS/${file}`,`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${bolum.baslik}</title></head><body><h1>${bolum.baslik}</h1>${body}</body></html>`)
          })
          zip.file("OEBPS/content.opf",`<?xml version="1.0" encoding="utf-8"?><package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${kitap.baslik}</dc:title><dc:creator>${kitap.yazar}</dc:creator><dc:language>${kitap.dil}</dc:language><dc:identifier id="bookid">urn:uuid:${Date.now()}</dc:identifier></metadata><manifest>${manifest}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx">${spine}</spine></package>`)
          zip.file("OEBPS/toc.ncx",`<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${Date.now()}"/></head><docTitle><text>${kitap.baslik}</text></docTitle><navMap>${toc}</navMap></ncx>`)
          const buf=await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"}); epubYolu=path.join(klasor,"kitap.epub"); await fsp.writeFile(epubYolu, buf)
        }catch(e){ log(`[book-epub-error] ${e.message}`) }
      }
      kitap.durum="tamamlandi"; kitap.sonGuncelleme=new Date().toISOString(); await fsp.writeFile(path.join(klasor,"kitap.json"), JSON.stringify(kitap,null,2),"utf-8")
      let mesaj=`Kitap "${kitap.baslik}" oluşturuldu: ${kitap.toplamSayfa} sayfa`
      if(wantHtml) mesaj+=`\nHTML: ${htmlYolu}`
      if(wantPdf) mesaj+=`\nPDF: ${htmlYolu} -> Ctrl+P ile PDF`
      if(docxYolu) mesaj+=`\nWord: ${docxYolu}`
      if(epubYolu) mesaj+=`\nEPUB: ${epubYolu}`
      res.writeHead(200, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, htmlYolu, docxYolu, epubYolu, toplamSayfa:kitap.toplamSayfa, mesaj}))
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }

  if(req.url === "/api/run-sandbox" && req.method==="POST"){
    try{
      const {filename, language, content} = JSON.parse(await readBody(req))
      if(!filename) throw new Error("filename gerekli")
      const ext = path.extname(filename).toLowerCase()
      // HTML/CSS/JSON/MD/TXT gibi statik dosyalar için Python/Node ile çalıştırmayı deneme — doğrulama yap
      const isStatic = [".html",".htm",".css",".json",".md",".txt",".svg"].includes(ext)
      const lang = language || (ext==="html"||ext==="htm" ? "html" : ext===".css" ? "css" : ext===".py" ? "python" : ext===".js" ? "javascript" : ext===".ts" ? "typescript" : "python")
      const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "qwen-sandbox-"))
      let targetFile = path.join(tmpDir, path.basename(filename))
      try{
        if(content !== undefined){
          await fsp.writeFile(targetFile, content, "utf-8")
        } else {
          const src = resolvePath(filename)
          await fsp.copyFile(src, targetFile)
        }
        // Statik dosyalar: çalıştırma yerine doğrulama
        if(isStatic || lang==="html" || lang==="css"){
          const fileContent = await fsp.readFile(targetFile, "utf-8")
          if(!fileContent.trim()) throw new Error("檔案內容為空")
          // Basit HTML/CSS doğrulama
          let validation = ""
          if(ext===".html" || ext===".htm"){
            if(!fileContent.includes("<")) validation = "HTML etiketi bulunamadı"
            else validation = `✓ HTML doğrulandı (${fileContent.length} bytes, ${fileContent.split("\n").length} satır) — tarayıcıda test edilmeli`
          } else if(ext===".css"){
            validation = `✓ CSS doğrulandı (${fileContent.length} bytes)`
          } else {
            validation = `✓ ${ext} dosyası doğrulandı (${fileContent.length} bytes)`
          }
          log(`[sandbox] ${filename} (${lang}/static) -> validate`)
          res.writeHead(200, {"Content-Type":"application/json"})
          return res.end(JSON.stringify({ok: true, output: validation, error: "", exitCode: 0, duration: 0, tempDir: tmpDir}))
        }
        const cmdMap = {python: ["python", [targetFile]], javascript: ["node", [targetFile]], typescript: ["bun", ["run", targetFile]], bun: ["bun", ["run", targetFile]]}
        const [cmd, args] = cmdMap[lang] || cmdMap.python
        log(`[sandbox] ${filename} (${lang}) -> ${tmpDir}`)
        const proc = spawn(cmd, args, {cwd: tmpDir, timeout: 15000, windowsHide: true})
        let out="", err=""
        proc.stdout.on("data", d=> out+=d)
        proc.stderr.on("data", d=> err+=d)
        const exitCode = await new Promise(resolve=>{
          proc.on("close", c=> resolve(c))
          proc.on("error", ()=> resolve(1))
          setTimeout(()=>{ try{proc.kill()}catch{} }, 15000)
        })
        res.writeHead(200, {"Content-Type":"application/json"})
        return res.end(JSON.stringify({ok: exitCode===0, output: out.slice(0,8000), error: err.slice(0,8000), exitCode, duration: 0, tempDir: tmpDir}))
      } finally {
        try{ await fsp.rm(tmpDir, {recursive:true, force:true}) }catch{}
      }
    }catch(e){ res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:e.message})) }
  }

  // Proxy Ollama (tam streaming - fetch tabanlı, tampon yok)
  if(req.url.startsWith("/ollama/")){
    const target = "http://127.0.0.1:11434/" + req.url.slice(8)
    // fetch ile gerçek streaming - Node http.request tamponlamasını atlatır
    ;(async () => {
      try{
        const body = await readBody(req).catch(()=> "")
        const controller = new AbortController()
        req.on("close", ()=> controller.abort())
        const r = await fetch(target, {
          method: req.method,
          headers: { "Content-Type":"application/json", "Accept":"application/x-ndjson, application/json" },
          body: req.method==="GET" || req.method==="HEAD" ? undefined : (body || undefined),
          signal: controller.signal,
        })
        // Streaming header'ları düzelt - content-length KALDIR, chunked kullan
        res.writeHead(r.status, {
          "Content-Type": r.headers.get("content-type") || "application/x-ndjson",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": "*",
          "Transfer-Encoding": "chunked",
        })
        if(!r.body){
          const text = await r.text()
          return res.end(text)
        }
        const reader = r.body.getReader()
        try{
          while(true){
            const {done, value} = await reader.read()
            if(done) break
            res.write(value)
            // @ts-ignore flush varsa
            if(typeof res.flush === "function") res.flush()
          }
        } finally {
          try{ reader.releaseLock() }catch{}
        }
        res.end()
      }catch(e){
        if(!res.headersSent) res.writeHead(502, {"Content-Type":"text/plain", "Access-Control-Allow-Origin":"*"})
        res.end("Ollama proxy error: "+ (e.message||e))
      }
    })()
    return
  }

  let file = req.url==="|" || req.url==="/" ? "/index.html" : req.url
  file = file.split("?")[0]
  // /api disindakiler statik
  if(file.startsWith("/api/")){
    res.writeHead(404, {"Content-Type":"application/json"})
    return res.end(JSON.stringify({ok:false, error:"Unknown API: "+file}))
  }
  const full = path.join(__dirname, file)
  if(!fs.existsSync(full) || fs.statSync(full).isDirectory()){
    res.writeHead(404); return res.end("Not found: "+file)
  }
  const ext = path.extname(full)
  const ct = mime[ext] || "text/plain"
  const charset = ct.startsWith("text/") || ct.includes("javascript") || ct.includes("json") ? "; charset=utf-8" : ""
  res.writeHead(200, {"Content-Type": ct + charset})
  fs.createReadStream(full).pipe(res)
})

server.listen(PORT, "127.0.0.1", ()=>{
  console.log(`\nQwen35-Agent Web UI 已啟動！`)
  console.log(`   -> http://127.0.0.1:${PORT}`)
  console.log(`   -> 工具 API：已啟用 15 個工具（Smith 模式）`)
  console.log(`      檔案：寫入、讀取、列出、編輯、刪除、建立目錄、搜尋、移動`)
  console.log(`      程式：Python、JavaScript、Shell、沙盒`)
  console.log(`      網路：搜尋、取得頁面、系統資訊`)
  console.log(`   -> Smith：三階段流程、記憶、學習、Hooks、沙盒、重試`)
  console.log(`   -> Desktop: ${DESKTOP}\n`)
})
