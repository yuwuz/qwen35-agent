const $ = s => document.querySelector(s)
const modelSelect = $("#modelSelect")
const thinkToggle = $("#thinkToggle")
const thinkBadge = $("#thinkBadge")
const smithToggle = $("#smithToggle")
const smithBadge = $("#smithBadge")
const ctxSelect = $("#ctxSelect")
const tempRange = $("#tempRange")
const tempVal = $("#tempVal")
const ctxFill = $("#ctxFill"), ctxUsed = $("#ctxUsed"), ctxTotal = $("#ctxTotal"), ctxPct = $("#ctxPct"), ctxSub = $("#ctxSub")
const chat = $("#chat")
const promptEl = $("#prompt"), sendBtn = $("#sendBtn"), stopBtn = $("#stopBtn")
const dropZone = $("#dropZone"), fileInput = $("#fileInput"), previewWrap = $("#previewWrap"), previewImg = $("#previewImg"), previewName = $("#previewName"), removeImg = $("#removeImg")
const historyEl = $("#history"), lastMeta = $("#lastMeta"), connStatus = $("#connStatus")
const fileNameEl = $("#fileName"), fileContentEl = $("#fileContent"), saveFileBtn = $("#saveFileBtn"), loadFileBtn = $("#loadFileBtn"), fileStatus = $("#fileStatus"), quickFiles = $("#quickFiles")
const clearBtn = $("#clearBtn")
const atPopup = $("#atPopup"), atList = $("#atList"), atPathEl = $("#atPath"), atBackBtn = $("#atBack"), atCloseBtn = $("#atClose")
const fileChips = $("#fileChips")
let selectedFiles = []

const BASE = "" // same origin - Ollama via /ollama proxy (CORS fix)
const OLLAMA = "/ollama" // server.js proxy -> http://127.0.0.1:11434
const WEB_BASE = "" // same origin for /api/write-file etc
let messages = []
let attachedImage = null
let totalTokens = 0
let abortController = null
let isGenerating = false

tempRange.oninput = () => tempVal.textContent = tempRange.value
thinkToggle.onchange = () => {
  thinkBadge.textContent = thinkToggle.checked ? "ON" : "OFF"
  thinkBadge.className = "badge " + (thinkToggle.checked ? "on" : "")
}
if(smithToggle){
  // Load saved
  try{ const saved = localStorage.getItem("qwen-smith"); if(saved!==null) { smithToggle.checked = saved==="true"; smithBadge.textContent = smithToggle.checked ? "ON" : "OFF"; smithBadge.className = "badge " + (smithToggle.checked ? "on" : "") } }catch{}
  smithToggle.onchange = () => {
    smithBadge.textContent = smithToggle.checked ? "ON" : "OFF"
    smithBadge.className = "badge " + (smithToggle.checked ? "on" : "")
    try{ localStorage.setItem("qwen-smith", String(smithToggle.checked)) }catch{}
  }
}
ctxSelect.onchange = () => { ctxTotal.textContent = ctxSelect.value; updateCtx() }
clearBtn.onclick = () => {
  if(messages.length>0 && !confirm("Delete messages in this chat?")) return
  messages = []; totalTokens = 0; chat.innerHTML = welcomeHTML(); historyEl.innerHTML=""; updateCtx(); updateHistory(); lastMeta.textContent="Cleared"
  if(activeId){
    const conv = conversations.find(c=>c.id===activeId)
    if(conv){ conv.messages = []; conv.title="Yeni Chat"; conv.updatedAt=Date.now() }
  }
  try{ localStorage.removeItem("qwen-chat"); }catch{}
  saveConversations(); renderConversationList()
}

function welcomeHTML(){
  return `<div class="welcome">
    <div class="welcome-icon">🤖</div>
    <h2>Welcome to Qwen35-Agent</h2>
    <p>Your local agent powered by Vision, Thinking, 256K Context and Tools.</p>
    <div class="chips">
      <button class="chip" data-prompt="Hello, create a file named hello.txt on the Desktop with content 'Hello from Qwen35-Agent!'">📄 Create hello.txt</button>
      <button class="chip" data-prompt="/think There are 17 sheep on a farm, all but 9 die, how many remain?">🧮 Logic puzzle</button>
      <button class="chip" data-prompt="Python ile binary search yaz">💻 Write code</button>
      <button class="chip" data-prompt="Analyze this image" data-need-image="1">🖼️ Analyze image</button>
      <button class="chip" data-prompt="Draw a dragon soaring over mountains at sunset, highly detailed and cinematic">🎨 Generate image</button>
    </div>
  </div>`
}
chat.addEventListener("click", e=>{
  const b = e.target.closest(".chip")
  if(!b) return
  if(b.dataset.needImage && !attachedImage) { alert("Please upload an image first!"); return }
  promptEl.value = b.dataset.prompt
  send()
})

dropZone.onclick = ()=> fileInput.click()
dropZone.ondragover = e=>{ e.preventDefault(); dropZone.classList.add("drag") }
dropZone.ondragleave = ()=> dropZone.classList.remove("drag")
dropZone.ondrop = e=>{
  e.preventDefault(); dropZone.classList.remove("drag")
  const f = e.dataTransfer.files[0]; if(f) handleFile(f)
}
fileInput.onchange = ()=> { const f=fileInput.files[0]; if(f) handleFile(f) }
function handleFile(file){
  if(!file.type.startsWith("image/")) return alert("Only images allowed!")
  const reader = new FileReader()
  reader.onload = ()=>{
    const base64 = reader.result.split(",")[1]
    attachedImage = { base64, name: file.name, dataUrl: reader.result }
    previewImg.src = reader.result
    previewName.textContent = file.name + " (" + (file.size/1024).toFixed(0)+"KB)"
    previewWrap.classList.remove("hidden")
    $("#attachBar").classList.remove("hidden")
    $("#attachName").textContent = "📎 " + file.name
  }
  reader.readAsDataURL(file)
}
removeImg.onclick = clearImage
$("#clearAttach").onclick = clearImage
function clearImage(){
  attachedImage=null; previewWrap.classList.add("hidden"); $("#attachBar").classList.add("hidden"); fileInput.value=""
}

const savedFiles = JSON.parse(localStorage.getItem("qwen-files")||"[]")
renderQuickFiles()
saveFileBtn.onclick = async ()=>{
  const name = fileNameEl.value.trim()
  const content = fileContentEl.value
  if(!name) return fileStatus.textContent="❌ Enter file name"
  // Gerçekten yaz: web server API ile
  try{
    const isAbs = name.includes(":") || name.startsWith("/") || name.startsWith("C:")
    const target = isAbs ? name : `A:\\AI\\qwen35-agent-test-workspace\\${name}`
    const r = await fetch("/api/write-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: target, content})})
    const j = await r.json()
    if(j.ok){
      fileStatus.textContent = "✅ Written: " + j.path
      savedFiles.unshift({name, content, time: Date.now()})
      localStorage.setItem("qwen-files", JSON.stringify(savedFiles.slice(0,20)))
      renderQuickFiles()
    } else fileStatus.textContent = "❌ " + j.error
  }catch(e){ fileStatus.textContent = "❌ " + e.message }
}
loadFileBtn.onclick = async ()=>{
  const name = fileNameEl.value.trim()
  if(!name) return fileStatus.textContent="❌ Enter file name"
  try{
    const target = name.includes(":") ? name : `A:\\AI\\qwen35-agent-test-workspace\\${name}`
    const r = await fetch("/api/read-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: target})})
    const j = await r.json()
    if(j.ok){ fileContentEl.value = j.content; fileStatus.textContent="✅ Read: "+target }
    else fileStatus.textContent="❌ "+j.error
  }catch(e){ fileStatus.textContent="❌ "+e.message }
}
function renderQuickFiles(){
  if(savedFiles.length===0){ quickFiles.innerHTML='<div class="empty">No files created yet</div>'; return }
  quickFiles.innerHTML = savedFiles.map(f=>`<div class="qfile"><span class="name">📄 ${f.name}</span><button class="btn small" onclick="navigator.clipboard.writeText(\`${f.content.replace(/`/g,"\\`")}\`)">Kopyala</button></div>`).join("")
}

function estimateTokens(text){ return Math.ceil(text.length/4) }
// Kaydırma: AI yazarken yukarı kaydırabilmek için sadece dipteyken oto-kaydır
function isNearBottom(){ return chat.scrollHeight - chat.scrollTop - chat.clientHeight < 140 }
function autoScroll(){ if(isNearBottom()) chat.scrollTop = chat.scrollHeight }
function updateCtx(){
  const used = messages.reduce((a,m)=> a + estimateTokens(m.content) + (m.images? 600:0), 0)
  totalTokens = used
  const total = parseInt(ctxTotal.textContent)
  const pct = Math.min(100, Math.round(used/total*100))
  ctxUsed.textContent = used
  ctxPct.textContent = pct+"%"
  ctxFill.style.width = pct+"%"
  ctxFill.style.background = pct>85 ? "#ef4444" : pct>60 ? "#eab308" : "linear-gradient(90deg,#3b82f6,#06b6d4)"
  ctxSub.textContent = `${messages.length} messages • ~${used} token • Kalan: ${total-used}`
}
function saveChat(){
  try{
    const toSave = messages.map(m=> ({role:m.role, content:m.content, tool_calls:m.tool_calls, thinking: m.thinking, images: m.images? ["[image]"] : undefined})).slice(-80)
    localStorage.setItem("qwen-chat", JSON.stringify(toSave))
    // Çoklu sohbeti de güncelle
    if(activeId){
      const conv = conversations.find(c=>c.id===activeId)
      if(conv){ conv.messages = [...toSave]; conv.updatedAt = Date.now(); if(conv.title==="Yeni Chat" && toSave.length>0) conv.title = toSave.find(m=>m.role==="user")?.content?.slice(0,40) || "Chat" }
      try{ localStorage.setItem("qwen-conversations", JSON.stringify(conversations.slice(-20))) }catch{}
      renderConversationList()
    }
  }catch(e){ console.warn("saveChat fail", e) }
}
function loadChat(){
  try{
    const raw = localStorage.getItem("qwen-chat")
    if(!raw) return
    const saved = JSON.parse(raw)
    if(!Array.isArray(saved) || saved.length===0) return
    messages = saved
    // render
    const w = chat.querySelector(".welcome")
    if(w) w.remove()
    for(const m of messages){
      if(m.role==="user") addMsg("user", m.content, {})
      else if(m.role==="assistant") addMsg("assistant", m.content, {toolCalls: m.tool_calls})
      else if(m.role==="tool") addMsg("assistant", `🔧 Tool: ${m.content.slice(0,200)}`, {})
    }
    updateCtx(); updateHistory()
    lastMeta.textContent = `Restored: ${messages.length} messages`
  }catch(e){ console.warn("loadChat fail", e) }
}

// === Çoklu Chat Yönetimi (Yeni Chat) ===
let conversations = []
let activeId = null
try{
  const rawC = localStorage.getItem("qwen-conversations")
  if(rawC) conversations = JSON.parse(rawC)
  activeId = localStorage.getItem("qwen-active-id")
}catch{}
function saveConversations(){
  try{
    localStorage.setItem("qwen-conversations", JSON.stringify(conversations.slice(-20)))
    if(activeId) localStorage.setItem("qwen-active-id", activeId)
    // Eski tekli ile de senkron tut
    const active = conversations.find(c=>c.id===activeId)
    if(active) localStorage.setItem("qwen-chat", JSON.stringify(active.messages.slice(-80)))
  }catch{}
}
function renderConversationList(){
  const el = $("#conversationList")
  if(!el) return
  if(conversations.length===0){
    el.innerHTML = '<div class="empty" style="padding:12px">No chats yet<br><span style="font-size:11px">Start with New Chat</span></div>'
    return
  }
  el.innerHTML = conversations.slice().reverse().map(c=>{
    const isActive = c.id===activeId
    const title = c.title || "Chat"
    const count = c.messages.length
    const date = new Date(c.updatedAt).toLocaleDateString("tr-TR", {month:"short", day:"numeric"})
    return `<div class="conversation-item ${isActive?"active":""}" data-id="${c.id}"><div class="c-title">${escapeHtml(title.slice(0,36))}</div><div class="c-sub"><span>${count} messages</span>•<span>${date}</span></div><button class="c-delete" data-del="${c.id}" title="Delete">✕</button></div>`
  }).join("")
  el.querySelectorAll(".conversation-item").forEach(item=>{
    item.onclick = (e)=>{
      if((e.target).closest(".c-delete")) return
      switchConversation(item.dataset.id)
    }
  })
  el.querySelectorAll(".c-delete").forEach(btn=>{
    btn.onclick = (e)=>{
      e.stopPropagation()
      deleteConversation(btn.dataset.del)
    }
  })
}
function createNewChat(){
  // Mevcutu kaydet (eğer doluysa)
  if(messages.length>0 && activeId){
    const cur = conversations.find(c=>c.id===activeId)
    if(cur){ cur.messages = [...messages]; cur.updatedAt = Date.now(); if(!cur.title && messages[0]) cur.title = messages[0].content.slice(0,40) }
    else {
      const id = activeId
      conversations.push({id, title: messages[0]?.content?.slice(0,40) || "Chat", messages: [...messages], createdAt: Date.now(), updatedAt: Date.now()})
    }
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,5)
  const newConv = {id, title: "Yeni Chat", messages: [], createdAt: Date.now(), updatedAt: Date.now()}
  conversations.push(newConv)
  activeId = id
  messages = []
  chat.innerHTML = welcomeHTML()
  updateCtx(); updateHistory(); saveConversations(); renderConversationList()
  lastMeta.textContent = "New chat created"
  // İlk messagesda başlık güncellensin diye
  promptEl.focus()
}
function switchConversation(id){
  const conv = conversations.find(c=>c.id===id)
  if(!conv) return
  // Mevcutu kaydet
  if(activeId){
    const cur = conversations.find(c=>c.id===activeId)
    if(cur){ cur.messages = [...messages]; cur.updatedAt = Date.now() }
  }
  activeId = id
  messages = [...conv.messages]
  chat.innerHTML = ""
  if(messages.length===0){
    chat.innerHTML = welcomeHTML()
  } else {
    for(const m of messages){
      if(m.role==="user") addMsg("user", m.content, {})
      else if(m.role==="assistant") addMsg("assistant", m.content, {toolCalls: m.tool_calls, thinking: m.thinking})
      else if(m.role==="tool") addMsg("assistant", `🔧 ${String(m.content).slice(0,300)}`, {})
    }
  }
  updateCtx(); updateHistory(); saveConversations(); renderConversationList()
  lastMeta.textContent = `Chat: ${conv.title} (${messages.length} messages)`
}
function deleteConversation(id){
  if(!confirm("Delete this chat?")) return
  conversations = conversations.filter(c=>c.id!==id)
  if(activeId===id){
    if(conversations.length){
      activeId = conversations[conversations.length-1].id
      messages = [...conversations.find(c=>c.id===activeId).messages]
    } else {
      activeId = null
      messages = []
      // Yeni boş sohbet oluştur
      const nid = Date.now().toString(36)
      conversations = [{id: nid, title: "Yeni Chat", messages: [], createdAt: Date.now(), updatedAt: Date.now()}]
      activeId = nid
    }
    chat.innerHTML = messages.length ? "" : welcomeHTML()
    if(messages.length) for(const m of messages){
      if(m.role==="user") addMsg("user", m.content, {})
      else if(m.role==="assistant") addMsg("assistant", m.content, {toolCalls: m.tool_calls})
    }
  }
  saveConversations(); renderConversationList(); updateCtx(); updateHistory()
}
function updateConversationTitle(){
  if(!activeId || messages.length===0) return
  const conv = conversations.find(c=>c.id===activeId)
  if(conv && conv.title==="Yeni Chat"){
    const firstUser = messages.find(m=>m.role==="user")
    if(firstUser){ conv.title = firstUser.content.slice(0,40); conv.updatedAt = Date.now(); saveConversations(); renderConversationList() }
  }
}

function getTools(){
  const tools=[]
  if($("#toolWeb").checked) tools.push(
    {type:"function", function:{name:"web_search", description:"Search the internet for up-to-date information via DuckDuckGo.", parameters:{type:"object", properties:{query:{type:"string", description:"Search query"}}, required:["query"]}}},
    {type:"function", function:{name:"fetch_url", description:"Fetch a URL and return its text content (up to 8000 chars).", parameters:{type:"object", properties:{url:{type:"string", description:"URL to fetch"}}, required:["url"]}}},
    {type:"function", function:{name:"get_system_info", description:"Get system info: OS, cwd, Desktop files, Ollama models.", parameters:{type:"object", properties:{}, required:[]}}},
  )
  if($("#toolFile").checked) tools.push(
    {type:"function", function:{name:"write_file", description:"Write content to a file. CRITICAL: If user does NOT specify directory, use ONLY filename like 'hello.txt' - system auto-saves to Desktop A:\\AI\\qwen35-agent-test-workspace\\. Creates directories if needed.", parameters:{type:"object", properties:{path:{type:"string", description:"File path - use just filename for Desktop, or full path. No dir = Desktop."}, content:{type:"string", description:"File content"}}, required:["path","content"]}}},
    {type:"function", function:{name:"read_file", description:"Read file content. Supports offset/limit for large files.", parameters:{type:"object", properties:{path:{type:"string", description:"File path"}, offset:{type:"number", description:"Start line"}, limit:{type:"number", description:"Max lines"}}, required:["path"]}}},
    {type:"function", function:{name:"list_files", description:"List files in directory.", parameters:{type:"object", properties:{path:{type:"string", description:"Directory path"}}, required:["path"]}}},
    {type:"function", function:{name:"edit_file", description:"Edit a file by replacing exact string. Use read_file first to see content.", parameters:{type:"object", properties:{path:{type:"string"}, old_string:{type:"string", description:"Exact string to replace"}, new_string:{type:"string", description:"New string"}}, required:["path","old_string","new_string"]}}},
    {type:"function", function:{name:"delete_file", description:"Delete a file or empty directory.", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
    {type:"function", function:{name:"create_directory", description:"Create a directory (including parents).", parameters:{type:"object", properties:{path:{type:"string"}}, required:["path"]}}},
    {type:"function", function:{name:"search_files", description:"Search text pattern in files (grep).", parameters:{type:"object", properties:{pattern:{type:"string"}, path:{type:"string"}, include:{type:"string"}}, required:["pattern"]}}},
    {type:"function", function:{name:"move_file", description:"Move or rename a file/directory.", parameters:{type:"object", properties:{source:{type:"string"}, destination:{type:"string"}}, required:["source","destination"]}}},
  )
  if($("#toolCode").checked) tools.push(
    {type:"function", function:{name:"run_python", description:"Execute Python code and return output. Use for calculations, data processing.", parameters:{type:"object", properties:{code:{type:"string", description:"Python code to execute"}}, required:["code"]}}},
    {type:"function", function:{name:"run_javascript", description:"Execute JavaScript via Node and return output.", parameters:{type:"object", properties:{code:{type:"string", description:"JavaScript code"}}, required:["code"]}}},
    {type:"function", function:{name:"run_bash", description:"Execute bash/shell command. Use for system operations, git, tests.", parameters:{type:"object", properties:{command:{type:"string", description:"Shell command"}}, required:["command"]}}},
    {type:"function", function:{name:"run_sandbox", description:"Test in sandbox - run file in isolated temp directory without affecting real files. Supports Python/JS/TS/Bun. Use for debugging and verification.", parameters:{type:"object", properties:{filename:{type:"string", description:"File name to test (e.g. script.py)"}, language:{type:"string", enum:["python","javascript","typescript","bun"]}, content:{type:"string", description:"Optional file content"}}, required:["filename"]}}},
  )
  if($("#toolVision").checked) tools.push({type:"function", function:{name:"analyze_image", description:"Analyze image (stub - vision is natively via chat images)", parameters:{type:"object", properties:{image:{type:"string"}, prompt:{type:"string"}}, required:["image"]}}})
  // Generate imageme — her zaman aktif (Pollinations.ai)
  tools.push(
    {type:"function", function:{name:"generate_image", description:"🎨 GENERATE IMAGE - Use MANDATORILY when user asks 'generate image', 'create picture', 'draw', 'generate visual', 'image generate', 'cat picture', 'draw landscape' etc. Translate request to detailed English prompt and generate image via Pollinations.ai. Result shown as image in message box.", parameters:{type:"object", properties:{prompt:{type:"string", description:"Detailed English image prompt"}, width:{type:"number", description:"Width (default 1024)"}, height:{type:"number", description:"Height (default 1024)"}, negative_prompt:{type:"string", description:"Negative prompt - things to avoid"}, seed:{type:"number", description:"Seed (-1 random)"}}, required:["prompt"]}}},
  )
  // Book yazma araçları — her zaman aktif (kalıcılık için, yeni sohbette devam eder)
  tools.push(
    {type:"function", function:{name:"book_create", description:"CREATE NEW BOOK - Use AUTOMATICALLY when user says 'write book', 'new book', 'write novel', 'write story', '3-page book'. Creates a complete book project with professional page layout (A5, margins, page numbers), structure. If page count specified (e.g. '3-page'), FILL sayfaSayisi. Stored permanently under Desktop/Booklar/.", parameters:{type:"object", properties:{baslik:{type:"string", description:"Book title (e.g. 'Whispers of Shadows')"}, yazar:{type:"string", description:"Author name"}, tur:{type:"string", description:"Genre: novel, story, fantasy..."}, ozet:{type:"string", description:"Book summary (2-3 sentences)"}, bolumSayisi:{type:"number", description:"Number of chapters"}, sayfaSayisi:{type:"number", description:"TARGET PAGE COUNT: 3-page=3, 5-page=5"}, dil:{type:"string", description:"Language: tr, en"}}, required:["baslik"]}}},
    {type:"function", function:{name:"book_status", description:"GET BOOK STATUS - List existing books, current chapter, page count, what's next. Use AUTOMATICALLY for 'continue where I left off' in a new chat. DIRECTORY SUPPORTED.", parameters:{type:"object", properties:{kitapAdi:{type:"string", description:"Book title OR full directory path (empty = list all)"}}, required:[]}}},
    {type:"function", function:{name:"book_add_chapter", description:"ADD CHAPTER - Add a new chapter to the book. Auto page range, starts on right page. DIRECTORY SUPPORTED.", parameters:{type:"object", properties:{kitapAdi:{type:"string", description:"Book title OR full directory path"}, baslik:{type:"string", description:"Chapter title"}, ozet:{type:"string", description:"Chapter summary"}}, required:["kitapAdi","baslik"]}}},
    {type:"function", function:{name:"book_write", description:"WRITE BOOK / CONTINUE - Write content to a specific chapter or continue where you left off. Text is automatically positioned, page numbers updated. DIRECTORY SUPPORTED.", parameters:{type:"object", properties:{kitapAdi:{type:"string", description:"Book title OR full directory path"}, bolumId:{type:"string", description:"Chapter ID (empty = next)"}, icerik:{type:"string", description:"Content to write (empty = AI continues)"}, konum:{type:"string", description:"Position: baslangic/start, orta/middle, son/end, devam/continue"}}, required:["kitapAdi"]}}},
    {type:"function", function:{name:"book_extend", description:"EXTEND BOOK - Continue an existing book from where you left off, ADD PAGES. Use AUTOMATICALLY when user in a new chat gives a directory and says 'add 2 pages'.", parameters:{type:"object", properties:{kitapYolu:{type:"string", description:"Book title OR full directory path"}, ekSayfa:{type:"number", description:"Number of pages to add (e.g. 2)"}, ekOzellik:{type:"string", description:"Optional extra topic"}}, required:["kitapYolu","ekSayfa"]}}},
    {type:"function", function:{name:"book_generate", description:"GENERATE BOOK - Combine all chapters with professional page layout: cover, table of contents (with page numbers), chapters (right page), page numbers. HTML/PDF ready. DIRECTORY SUPPORTED.", parameters:{type:"object", properties:{kitapAdi:{type:"string", description:"Book title OR full directory path"}, format:{type:"string", enum:["html","pdf","her-ikisi"], description:"Format"}}, required:["kitapAdi"]}}},
  )
  return tools
}

// Tool executor - gerçek icra (server.js ile ayni normalize)
function normalizePathForTool(p){
  if(!p) return p
  // absolute Windows path -> keep
  if(/^[A-Za-z]:[\\/]/.test(p)) return p
  // normalize slash
  const n = p.replace(/\//g, "\\")
  if(n.toLowerCase().startsWith("desktop\\") || n.toLowerCase()==="desktop") return p // server handles
  if(!n.includes("\\")) return p // filename -> server goes to Desktop
  return p
}
async function executeToolCall(toolCall){
  const name = toolCall.function.name
  const args = toolCall.function.arguments
  let parsed = args
  if(typeof args === "string"){
    try{ parsed = JSON.parse(args) }catch{ parsed = {} }
  }
  try{
    if(name==="write_file"){
      const r = await fetch("/api/write-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: normalizePathForTool(parsed.path), content: parsed.content})})
      const j = await r.json()
      return j.ok ? `✅ File written to ${j.path} (${j.size} bytes)` : `❌ Error: ${j.error}`
    }
    if(name==="read_file"){
      const r = await fetch("/api/read-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: normalizePathForTool(parsed.path), offset: parsed.offset, limit: parsed.limit})})
      const j = await r.json()
      return j.ok ? `Content of ${j.path}:\n${j.content}` : `❌ Error: ${j.error}`
    }
    if(name==="list_files"){
      const r = await fetch("/api/list-files", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: normalizePathForTool(parsed.path)})})
      const j = await r.json()
      return j.ok ? `Files in ${j.path}:\n${j.files.join("\n")}` : `❌ Error: ${j.error}`
    }
    if(name==="edit_file"){
      const r = await fetch("/api/edit-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: normalizePathForTool(parsed.path), old_string: parsed.old_string, new_string: parsed.new_string})})
      const j = await r.json()
      return j.ok ? `✅ Edited ${j.path}` : `❌ Error: ${j.error}`
    }
    if(name==="delete_file"){
      const r = await fetch("/api/delete-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: normalizePathForTool(parsed.path)})})
      const j = await r.json()
      return j.ok ? `✅ Deleted ${j.path}` : `❌ Error: ${j.error}`
    }
    if(name==="create_directory"){
      const r = await fetch("/api/create-directory", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: normalizePathForTool(parsed.path)})})
      const j = await r.json()
      return j.ok ? `✅ Created ${j.path}` : `❌ Error: ${j.error}`
    }
    if(name==="search_files"){
      const r = await fetch("/api/search-files", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({pattern: parsed.pattern, path: parsed.path ? normalizePathForTool(parsed.path) : undefined, include: parsed.include})})
      const j = await r.json()
      return j.ok ? `Search "${parsed.pattern}" in ${j.path}: ${j.count} matches\n${j.results.join("\n")}` : `❌ Error: ${j.error}`
    }
    if(name==="move_file"){
      const r = await fetch("/api/move-file", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({source: normalizePathForTool(parsed.source), destination: normalizePathForTool(parsed.destination)})})
      const j = await r.json()
      return j.ok ? `✅ Moved ${j.source} -> ${j.destination}` : `❌ Error: ${j.error}`
    }
    if(name==="run_python"){
      const r = await fetch("/api/run-python", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({code: parsed.code})})
      const j = await r.json()
      return (j.output||"") + (j.error? "\nERR: "+j.error:"") + ` (exit ${j.exitCode})`
    }
    if(name==="run_javascript"){
      const r = await fetch("/api/run-javascript", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({code: parsed.code})})
      const j = await r.json()
      return (j.output||"") + (j.error? "\nERR: "+j.error:"") + ` (exit ${j.exitCode})`
    }
    if(name==="run_bash"){
      const r = await fetch("/api/run-bash", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({command: parsed.command})})
      const j = await r.json()
      return (j.output||"") + (j.error? "\nERR: "+j.error:"") + ` (ok: ${j.ok})`
    }
    if(name==="run_sandbox"){
      const r = await fetch("/api/run-sandbox", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({filename: parsed.filename, language: parsed.language, content: parsed.content})})
      const j = await r.json()
      return j.ok ? `✅ Sandbox OK:\n${j.output.slice(0,3000)}` : `❌ Sandbox FAIL:\n${(j.error||"").slice(0,2000)}\n${j.output?.slice(0,1000)||""}`
    }
    if(name==="fetch_url"){
      const r = await fetch("/api/fetch-url", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({url: parsed.url})})
      const j = await r.json()
      return j.ok ? `Fetched ${j.url} (${j.size} chars):\n${j.content}` : `❌ Error: ${j.error}`
    }
    if(name==="get_system_info"){
      const r = await fetch("/api/get-system-info", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({})})
      const j = await r.json()
      return j.ok ? `System Info:\n${JSON.stringify(j.info, null, 2)}` : `❌ Error: ${j.error}`
    }
    if(name==="web_search"){
      try{
        const r = await fetch("/api/web-search", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({query: parsed.query})})
        const j = await r.json()
        if(j.ok && j.results && j.results.length){
          return `Web search results for "${parsed.query}":\n` + j.results.map((x,i)=> `${i+1}. ${x.title}\n   ${x.url}\n   ${x.snippet}`).join("\n\n")
        }
        return `Web search for "${parsed.query}" - sonuç yok: ${j.error || 'boş sonuç'} (model bilgisiyle devam et)`
      }catch(e){ return `Web search error: ${e.message} - model bilgisiyle devam et` }
    }
    if(name==="analyze_image"){
      return `Image analysis for ${parsed.image}: ${parsed.prompt||"describe"} - (vision is via chat images, not tool)`
    }
    if(name==="generate_image"){
      try{
        const r = await fetch("/api/generate-image",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({prompt: parsed.prompt, width: parsed.width, height: parsed.height, seed: parsed.seed, negative_prompt: parsed.negative_prompt})})
        const j = await r.json()
        if(j.ok){
          // Tool sonucu hem markdown hem URL içersin, addMsg markdown image'ı render edecek
          return `✅ Generate imageildi!

🎨 Prompt: "${j.prompt}"
📐 Boyut: ${j.width}x${j.height}
🔗 URL: ${j.url}

![${j.prompt.slice(0,60)}](${j.url})

Pollinations direkt link: ${j.url}`
        } else return `❌ ${j.error}`
      }catch(e){ 
        // Fallback: client side URL build (server yoksa)
        const enc = encodeURIComponent(parsed.prompt||"")
        const w = parsed.width || 1024
        const h = parsed.height || 1024
        const url = `https://image.pollinations.ai/prompt/${enc}?width=${w}&height=${h}&model=flux&nologo=true&seed=${Math.floor(Math.random()*999999)}`
        return `✅ Generate imageildi (client fallback)!

🎨 Prompt: "${parsed.prompt}"
📐 Boyut: ${w}x${h}
🔗 URL: ${url}

![${String(parsed.prompt).slice(0,60)}](${url})`
      }
    }
    if(name==="book_create"){
      const r = await fetch("/api/book-create",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({baslik: parsed.baslik, yazar: parsed.yazar, tur: parsed.tur, ozet: parsed.ozet, bolumSayisi: parsed.bolumSayisi, sayfaSayisi: parsed.sayfaSayisi, dil: parsed.dil})})
      const j = await r.json(); return j.ok ? `✅ ${j.messages}\n${JSON.stringify(j.kitap,null,2)}` : `❌ ${j.error}`
    }
    if(name==="book_status"){
      const r = await fetch("/api/book-status",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({kitapAdi: parsed.kitapAdi})})
      const j = await r.json(); if(j.ok && j.kitap) return `📖 ${j.kitap.baslik}\n${JSON.stringify(j.kitap,null,2)}`; if(j.ok && j.kitaplar) return j.kitaplar.length? j.kitaplar.map(k=>`📖 ${k.baslik} - ${k.tamam} - ${k.siradaki}`).join("\n") : j.messages; return `❌ ${j.error}`
    }
    if(name==="book_add_chapter"){
      const r = await fetch("/api/book-add-chapter",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({kitapAdi: parsed.kitapAdi, baslik: parsed.baslik, ozet: parsed.ozet})})
      const j = await r.json(); return j.ok ? `✅ Bölüm eklendi: ${j.bolum.id} - ${j.bolum.baslik}` : `❌ ${j.error}`
    }
    if(name==="book_write"){
      const r = await fetch("/api/book-write",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({kitapAdi: parsed.kitapAdi, bolumId: parsed.bolumId, icerik: parsed.icerik, konum: parsed.konum})})
      const j = await r.json(); return j.ok ? `✅ ${j.bolum.baslik} yazıldı (${j.bolum.kelimeSayisi} kelime, ${j.toplamSayfa} sayfa)\n${j.siradaki?`Sıradaki: ${j.siradaki.baslik} (${j.siradaki.id})`:"Tüm bölümler bitti, book_generate ile oluştur"}` : `❌ ${j.error}${j.ozet?`\nÖzet: ${j.ozet}`:""}`
    }
    if(name==="book_generate"){
      const r = await fetch("/api/book-generate",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({kitapAdi: parsed.kitapAdi, format: parsed.format})})
      const j = await r.json(); return j.ok ? `✅ ${j.messages}\nHTML: ${j.htmlYolu}` : `❌ ${j.error}`
    }
    return `Unknown tool ${name}`
  }catch(e){ return `❌ Tool execution error: ${e.message}` }
}

promptEl.onkeydown = e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send() } }
promptEl.oninput = ()=>{ promptEl.style.height="auto"; promptEl.style.height= Math.min(140, promptEl.scrollHeight)+"px"; $("#charCount").textContent = promptEl.value.length ? promptEl.value.length+" karakter" : "" }
sendBtn.onclick = send
// ── @ File Selectici — yukarı doğru, Desktop'tan başlar, ileri/geri, okut/değiştir ──
let atCurrentPath = "A:\\AI\\qwen35-agent-test-workspace"
let atHistoryStack = []
let atFiles = []
let atFiltered = []
let atSelected = 0
let atStartPos = -1
let atQuery = ""
const atHint = document.getElementById("atHint")

async function loadAtFiles(p){
  atCurrentPath = p
  const display = p.replace("A:\\AI\\qwen35-agent-test-workspace","Desktop").replace(/^Desktop\\/,"") || "Desktop"
  if(atPathEl) atPathEl.textContent = display
  if(atList) atList.innerHTML = `<div style="padding:12px;color:var(--muted);font-size:12px">Loading...</div>`
  try{
    const r = await fetch("/api/list-files",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path:p})})
    const j = await r.json()
    if(!j.ok) throw new Error(j.error)
    atFiles = j.files.map(s=>{
      const isDir = s.startsWith("DIR ")
      const name = s.slice(isDir?4:5, s.lastIndexOf(" (")).trim()
      const size = s.slice(s.lastIndexOf("("))
      return {raw:s, name, isDir, size}
    })
    renderAtList()
  }catch(e){
    if(atList) atList.innerHTML = `<div style="padding:12px;color:var(--red);font-size:12px">Hata: ${escapeHtml(e.message)}</div>`
  }
}
function renderAtList(){
  const q = atQuery.toLowerCase()
  atFiltered = q ? atFiles.filter(f=> f.name.toLowerCase().includes(q)) : [...atFiles]
  atFiltered.sort((a,b)=> (a.isDir===b.isDir? a.name.localeCompare(b.name) : a.isDir? -1:1))
  if(!atList) return
  if(atFiltered.length===0){
    atList.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted2);font-size:12px">File not found<br><span style="font-size:11px">“${escapeHtml(atQuery)}” no results for</span></div>`
    return
  }
  atList.innerHTML = atFiltered.map((f,i)=>{
    const iconClass = f.isDir ? "dir" : "file"
    const icon = f.isDir ? "📁" : "📄"
    const sel = i===atSelected ? " active" : ""
    return `<div class="at-item${sel}" data-idx="${i}">
      <div class="at-item-icon ${iconClass}">${icon}</div>
      <span class="at-item-name">${escapeHtml(f.name)}</span>
      <span class="at-item-size">${escapeHtml(f.size)}</span>
      <div class="at-item-actions">
        ${f.isDir ? `<button class="btn small ghost at-open" data-idx="${i}">Open</button>` : `<button class="btn small ghost at-read" data-idx="${i}">Read</button><button class="btn small primary at-select" data-idx="${i}">Select</button>`}
      </div>
    </div>`
  }).join("")
  atList.querySelectorAll(".at-item").forEach(el=>{
    el.addEventListener("click", (e)=>{
      if(e.target.closest(".at-item-actions")) return
      const idx = parseInt(el.dataset.idx)
      const f = atFiltered[idx]
      if(f.isDir) navigateAt(f.name)
      else selectAtFile(f)
    })
  })
  atList.querySelectorAll(".at-open").forEach(b=>{
    b.addEventListener("click", (e)=>{ e.stopPropagation(); const f=atFiltered[parseInt(b.dataset.idx)]; navigateAt(f.name) })
  })
  atList.querySelectorAll(".at-select").forEach(b=>{
    b.addEventListener("click", (e)=>{ e.stopPropagation(); const f=atFiltered[parseInt(b.dataset.idx)]; selectAtFile(f) })
  })
  atList.querySelectorAll(".at-read").forEach(b=>{
    b.addEventListener("click", async (e)=>{ e.stopPropagation(); const f=atFiltered[parseInt(b.dataset.idx)]; await readAtFile(f) })
  })
  const active = atList.querySelector(".at-item.active")
  if(active) active.scrollIntoView({block:"nearest"})
}
function navigateAt(name){
  const next = atCurrentPath.endsWith("\\") ? atCurrentPath + name : atCurrentPath + "\\" + name
  atHistoryStack.push(atCurrentPath)
  loadAtFiles(next)
}
function goAtBack(){
  if(atHistoryStack.length){
    const prev = atHistoryStack.pop()
    loadAtFiles(prev)
  } else {
    const lastSlash = atCurrentPath.lastIndexOf("\\")
    const parent = lastSlash>0 ? atCurrentPath.slice(0, lastSlash) : atCurrentPath
    if(parent && parent.length >= "A:\\AI\\qwen35-agent-test-workspace".length) loadAtFiles(parent)
    else loadAtFiles("A:\\AI\\qwen35-agent-test-workspace")
  }
}
async function readAtFile(f){
  const full = atCurrentPath.endsWith("\\") ? atCurrentPath + f.name : atCurrentPath + "\\" + f.name
  if(fileNameEl) fileNameEl.value = full
  try{
    const r = await fetch("/api/read-file",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: full})})
    const j = await r.json()
    if(j.ok){ if(fileContentEl) fileContentEl.value = j.content; if(fileStatus) fileStatus.textContent = "Read: "+full; if(atHint) atHint.textContent = "Readndu ✓"; setTimeout(()=>{ if(atHint) atHint.textContent="" },1500) }
    else if(fileStatus) fileStatus.textContent = j.error
  }catch(e){ if(fileStatus) fileStatus.textContent = e.message }
}
function selectAtFile(f){
  const full = atCurrentPath.endsWith("\\") ? atCurrentPath + f.name : atCurrentPath + "\\" + f.name
  // Input'u uzatma — çip olarak göster, yazı küçük
  addFileChip(full, f.name)
  // Prompt'taki @query'yi temizle (input kısa kalsın)
  if(atStartPos>=0){
    const cursor = promptEl.selectionStart || 0
    const before = promptEl.value.slice(0, atStartPos)
    const after = promptEl.value.slice(cursor)
    promptEl.value = before + after
    promptEl.focus()
    setTimeout(()=> promptEl.setSelectionRange(atStartPos, atStartPos), 0)
  }
  if(fileNameEl) fileNameEl.value = full
  fetch("/api/read-file",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: full})}).then(r=>r.json()).then(j=>{ if(j.ok && fileContentEl) fileContentEl.value = j.content }).catch(()=>{})
  hideAtPopup()
  promptEl.dispatchEvent(new Event("input"))
}
function showAtPopup(){
  if(atPopup) atPopup.classList.remove("hidden")
  if(atFiles.length===0) loadAtFiles(atCurrentPath)
  else renderAtList()
}
function hideAtPopup(){
  if(atPopup) atPopup.classList.add("hidden")
  atStartPos = -1
  atQuery = ""
}
function checkAtTrigger(){
  const cursor = promptEl.selectionStart || 0
  const textBefore = promptEl.value.slice(0, cursor)
  const atIdx = textBefore.lastIndexOf("@")
  if(atIdx===-1){ hideAtPopup(); return }
  const beforeChar = atIdx===0 ? " " : textBefore[atIdx-1]
  if(beforeChar!==" " && beforeChar!=="\n" && beforeChar!=="\t"){ hideAtPopup(); return }
  const query = textBefore.slice(atIdx+1)
  if(query.includes(" ") || query.includes("\n")){ hideAtPopup(); return }
  atStartPos = atIdx
  atQuery = query
  atSelected = 0
  showAtPopup()
  renderAtList()
}
if(atBackBtn) atBackBtn.onclick = goAtBack
if(atCloseBtn) atCloseBtn.onclick = hideAtPopup
promptEl.addEventListener("input", ()=>{ checkAtTrigger(); })
promptEl.addEventListener("click", checkAtTrigger)
promptEl.addEventListener("keyup", (e)=>{
  if(e.key==="@" || e.key.length===1 || e.key==="Backspace") setTimeout(checkAtTrigger,0)
})
promptEl.addEventListener("keydown", (e)=>{
  if(!atPopup || atPopup.classList.contains("hidden")) return
  if(e.key==="ArrowDown"){ e.preventDefault(); atSelected = Math.min(atSelected+1, atFiltered.length-1); renderAtList() }
  else if(e.key==="ArrowUp"){ e.preventDefault(); atSelected = Math.max(atSelected-1, 0); renderAtList() }
  else if(e.key==="Enter"){
    if(atFiltered[atSelected]){
      e.preventDefault()
      const f = atFiltered[atSelected]
      if(f.isDir) navigateAt(f.name)
      else selectAtFile(f)
    }
  }
  else if(e.key==="Escape"){ e.preventDefault(); hideAtPopup() }
})
document.addEventListener("click", (e)=>{
  if(!atPopup || atPopup.classList.contains("hidden")) return
  if(!atPopup.contains(e.target) && e.target!==promptEl) hideAtPopup()
})
// ── Selectili dosyalar — input üstünde çip, uzun path yok, yazı küçük ──
function renderFileChips(){
  if(!fileChips) return
  if(selectedFiles.length===0){ fileChips.classList.add("hidden"); fileChips.innerHTML=""; return }
  fileChips.classList.remove("hidden")
  fileChips.innerHTML = selectedFiles.map((f,i)=> `
    <span class="file-chip ${f.type==='url'?'url-chip':''}">
      <span class="chip-icon">${f.type==='url'?'🔗':'📄'}</span>
      <span class="chip-name" title="${escapeHtml(f.path||f.url)}">${escapeHtml(f.name)}</span>
      <button class="chip-remove" data-idx="${i}" title="Remove">✕</button>
    </span>
  `).join("")
  fileChips.querySelectorAll(".chip-remove").forEach(b=>{
    b.onclick = ()=>{ selectedFiles.splice(parseInt(b.dataset.idx),1); renderFileChips() }
  })
}
function addFileChip(fullPath, name){
  if(selectedFiles.find(f=> f.path===fullPath)) return
  selectedFiles.push({type:'file', name, path: fullPath})
  renderFileChips()
}
function addUrlChip(url){
  const clean = url.replace(/[.,;!?]+$/,"")
  if(selectedFiles.find(f=> f.url===clean)) return
  const display = clean.length>30 ? clean.slice(0,27)+"…" : clean
  selectedFiles.push({type:'url', name: display, url: clean})
  renderFileChips()
}
function clearFileChips(){ selectedFiles=[]; renderFileChips() }
// URL yapıştırınca otomatik algıla — input uzamasın, çip olsun
promptEl.addEventListener("paste", ()=>{
  setTimeout(()=>{
    const text = promptEl.value
    const urls = text.match(/https?:\/\/[^\s"']+/g)
    if(urls) urls.forEach(u=>{
      addUrlChip(u)
      // input içindeki uzun url'yi kaldır, yerine kısa placeholder bırak
      promptEl.value = promptEl.value.replace(u, "")
      promptEl.dispatchEvent(new Event("input"))
    })
  }, 80)
})
// Yazı küçük olsun — prompt zaten 14px, chip 11px ile dengeli
if(stopBtn){
  stopBtn.onclick = ()=>{
    if(abortController && isGenerating){
      abortController.abort()
      // UI hemen durduruldu olarak güncelle
      const typingEl = document.querySelector(".msg.assistant:last-child")
      if(typingEl && typingEl.textContent.includes("⏳")){
        typingEl.innerHTML = `<div class="avatar">Q</div><div class="bubble"><p style="color:var(--muted)">⏹ Stopped</p></div>`
        setTimeout(()=>{ try{ typingEl.remove() }catch{} }, 1500)
      }
      addMsg("assistant", "⏹ *Stopped — cancelled by user*")
      isGenerating = false
      sendBtn.style.display = ""
      stopBtn.style.display = "none"
      sendBtn.disabled = false
      sendBtn.textContent = "▶"
      promptEl.focus()
    }
  }
}
document.addEventListener("keydown", e=>{
  if(e.key==="Escape" && isGenerating && abortController){
    e.preventDefault()
    stopBtn?.click()
  }
})

// ── Syntax highlight + Kod Editörü (satır numaraları) ──
function highlightCode(code, lang){
  let html = escapeHtml(code)
  // Yorumlar
  html = html.replace(/\/\/.*$/gm, m=> `<span class="tok-comment">${m}</span>`)
  html = html.replace(/^#.*$/gm, m=> `<span class="tok-comment">${m}</span>`)
  html = html.replace(/\/\*[\s\S]*?\*\//g, m=> `<span class="tok-comment">${m}</span>`)
  // Stringler (&quot; ve &#39; dahil)
  html = html.replace(/&quot;.*?&quot;/g, m=> `<span class="tok-string">${m}</span>`)
  html = html.replace(/&#39;.*?&#39;/g, m=> `<span class="tok-string">${m}</span>`)
  html = html.replace(/`[^`]*`/g, m=> `<span class="tok-string">${m}</span>`)
  // Sayılar (string içindekiler hariç - basit)
  html = html.replace(/\b(\d+\.?\d*)\b/g, (m)=>{
    if(m.includes("tok-")) return m
    return `<span class="tok-number">${m}</span>`
  })
  // Keywordler
  const kws = /\b(function|const|let|var|if|else|for|while|return|import|export|from|class|async|await|try|catch|finally|new|typeof|instanceof|break|continue|switch|case|default|throw|extends|super|this|yield|def|print|console|document|window|process|require|module|exports|in|of|and|or|not|elif|with|as|true|false|null|undefined|int|str|float|bool|list|dict)\b/g
  html = html.replace(kws, `<span class="tok-keyword">$1</span>`)
  // Fonksiyon isimleri: kelime + (
  html = html.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, (m, name)=>{
    if(name.includes("tok-")) return m
    // keyword'ü tekrar boyama
    if(/^(function|if|for|while|switch|catch)$/.test(name)) return m
    return `<span class="tok-function">${name}</span>`
  })
  return html
}
function renderCodeEditor(lang, code){
  const lines = code.replace(/\n$/,"").split("\n")
  const gutter = lines.map((_,i)=> `<span>${i+1}</span>`).join("")
  const highlighted = highlightCode(code, lang)
  // highlighted'ı satırlara böl ve her satırı ayrı tut (basit: tümünü tek pre içinde)
  const langLabel = lang ? escapeHtml(lang) : "code"
  const lineCount = lines.length
  return `<div class="code-editor-wrap">
    <div class="code-editor-header">
      <span class="lang">${langLabel} · ${lineCount} satır</span>
      <button class="btn small ghost copy-code" data-code="${encodeURIComponent(code)}">📋 Kopyala</button>
    </div>
    <div class="code-editor">
      <div class="code-gutter">${gutter}</div>
      <div class="code-content">${highlighted}</div>
    </div>
  </div>`
}
function toolIcon(name){
  if(["write_file","read_file","list_files","edit_file","delete_file","create_directory","search_files","move_file"].includes(name)) return "file"
  if(["run_python","run_javascript","run_bash","run_sandbox"].includes(name)) return "code"
  if(["web_search","fetch_url"].includes(name)) return "web"
  if(["generate_image"].includes(name)) return "image"
  return "system"
}
function renderToolBox(tc, result, idx){
  const name = tc.function.name
  const args = typeof tc.function.arguments === "string" ? (()=>{ try{ return JSON.parse(tc.function.arguments)}catch{ return tc.function.arguments }})() : tc.function.arguments
  const argsStr = typeof args === "object" ? JSON.stringify(args, null, 2) : String(args)
  const icon = toolIcon(name)
  const hasResult = result !== undefined
  const isError = hasResult && (String(result).startsWith("❌") || String(result).toLowerCase().includes("error"))
  const status = !hasResult ? "running" : (isError ? "error" : "success")
  const statusText = !hasResult ? "● Çalışıyor" : (isError ? "● Hata" : "● Başarılı")
  const preview = hasResult ? String(result).slice(0,500) : ""
  // generate_image için thumb’ı TOOL kutusunda gösterme — büyük görsel zaten messagesın EN ALTINDA gösterilecek (tek görsel, kafa karışmasın)
  let imagePreview = ""
  const iconMap = {file:"📁", code:"💻", web:"🌐", image:"🎨", system:"⚙️"}
  return `<div class="tool-box">
    <div class="tool-box-header">
      <div class="tool-icon ${icon}">${iconMap[icon]||"⚙️"}</div>
      <span class="tool-name">${escapeHtml(name)}</span>
      <span class="tool-desc">${escapeHtml(tc.function.description||"")}</span>
      <span class="tool-status ${status}">${statusText}</span>
    </div>
    <div class="tool-args">${escapeHtml(argsStr)}</div>
    ${hasResult ? `<div class="tool-result ${isError?"error":"success"}">${escapeHtml(preview)}${imagePreview}</div>` : ""}
  </div>`
}

function addMsg(role, content, opts={}){
  const w = chat.querySelector(".welcome")
  if(w) w.remove()
  const div = document.createElement("div")
  div.className = "msg " + role
  const avatar = role==="user" ? "S" : "Q"
  let html = content || ""
  // Markdown: code blocks -> Kod Editörü (satır numaralı, renkli)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (m,lang,code)=>{
    return renderCodeEditor(lang||"", code)
  })
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>")
  // Image: Markdown image ![alt](url) -> <img>
  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m, alt, url)=>{
    const safeAlt = escapeHtml(alt)
    const safeUrl = url.replace(/"/g, "&quot;")
    return `<div style="margin:10px 0"><img src="${safeUrl}" alt="${safeAlt}" style="max-width:100%;max-height:520px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:block" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div style="display:none;font-size:11px;color:var(--muted);margin-top:4px">Image failed to load: <a href="${safeUrl}" target="_blank" style="color:var(--accent)">${safeUrl}</a></div><div style="font-size:11px;color:var(--muted2);margin-top:4px">🎨 ${safeAlt} • <a href="${safeUrl}" target="_blank" style="color:var(--accent)">Open full size</a> • <button onclick="navigator.clipboard.writeText('${safeUrl}')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11px;padding:0">🔗 Kopyala</button></div></div>`
  })
  // Pollinations raw URL'i direkt görsele çevir (eğer markdown değilse) - sadece pollinations ve görsel uzantıları
  html = html.replace(/(?<!["'=])(https?:\/\/image\.pollinations\.ai\/prompt\/[^\s<"]+)/g, (m, url)=>{
    if(html.includes(`src="${url}"`)) return m // zaten img içinde
    return `<div style="margin:10px 0"><img src="${url}" style="max-width:100%;max-height:520px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:block" loading="lazy" onerror="this.style.display='none'"><div style="font-size:11px;color:var(--muted2);margin-top:4px"><a href="${url}" target="_blank" style="color:var(--accent)">🔗 ${url.slice(0,60)}...</a></div></div>`
  })
  // Bold, italic, links (linkleri <img src=""> içindeki URL'lere dokunmadan)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>")
  html = html.replace(/(?<!["'=\(])(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" style="color:var(--accent)">$1</a>')
  // Eğer toolResults içinde Pollinations görseli var ve html'de yoksa, otomatik ekle (model sadece URL yazdıysa bile görsel göster)
  if((opts.toolResults && opts.toolResults.length) || (opts.toolCalls && opts.toolCalls.some(tc=> tc.function.name==="generate_image"))){
    const allResults = (opts.toolResults || []).map(r=> String(r)).join(" ")
    const urls = [...allResults.matchAll(/https?:\/\/image\.pollinations\.ai\/prompt\/[^\s"']+/g)].map(m=>m[0])
    // Ayrıca html içinde markdown dışı URL varsa da yakala
    if(urls.length && !html.includes("image.pollinations.ai")){
      const imgs = urls.map(u=> `<div style="margin:12px 0"><img src="${u}" style="max-width:100%;max-height:520px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:block" loading="lazy" onerror="this.style.display='none'"><div style="font-size:11px;color:var(--muted);margin-top:4px">🎨 Oluşturulan görsel • <a href="${u}" target="_blank" style="color:var(--accent)">Open full size</a> • <button onclick="navigator.clipboard.writeText('${u}')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11px;padding:0">🔗 Kopyala</button></div></div>`).join("")
      html += imgs
    }
  }
  html = html.replace(/\n/g, "<br>")
  let thinkingHtml = ""
  if(opts.thinking){
    thinkingHtml = `<details class="thinking"><summary>💭 Thinking process (${opts.thinking.length} karakter)</summary><div style="white-space:pre-wrap;margin-top:6px">${escapeHtml(opts.thinking)}</div></details>`
  }
  let toolHtml = ""
  if(opts.toolCalls && opts.toolCalls.length){
    // Her tool için ayrı kutucuk
    toolHtml = opts.toolCalls.map((tc,i)=>{
      const res = opts.toolResults ? opts.toolResults[i] : undefined
      return renderToolBox(tc, res, i)
    }).join("")
    // Eğer toolResults yoksa sadece çağrılar
    if(!opts.toolResults || opts.toolResults.length===0){
      // zaten yukarıda res undefined ile running gösterir
    }
  } else if(opts.toolResults && opts.toolResults.length){
    // Sadece sonuçlar - görsel varsa tool meta'da tekrar gösterme, büyük görsel zaten html'in EN ALTINDA eklenecek
    const hasImage = opts.toolResults.some(r=> String(r).includes("image.pollinations.ai"))
    if(hasImage){
      toolHtml = opts.toolResults.map(r=>{
        const str = String(r)
        const m = str.match(/https?:\/\/image\.pollinations\.ai\/prompt\/[^\s"']+/)
        const link = m ? ` • <a href="${m[0]}" target="_blank" style="color:var(--accent)">🔗 Link</a>` : ""
        return `<div class="meta" style="border-color:#22c55e;font-size:11px"><b>✅ Generate imageildi</b>${link}</div>`
      }).join("")
    } else {
      toolHtml = `<div class="meta" style="border-color:#22c55e"><b>✅ Tool Sonuçları:</b><br>${opts.toolResults.map(r=> escapeHtml(r)).join("<br><br>")}</div>`
    }
  }
  let imgHtml = ""
  if(opts.image){
    imgHtml = `<img src="${opts.image}" style="max-width:280px;border-radius:10px;margin-bottom:8px">`
  }
  let chipsHtml = ""
  if(opts.chips && opts.chips.length){
    chipsHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">` + opts.chips.map(c=> `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 7px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;font-size:11px;color:var(--text2)">${c.type==='url'?'🔗':'📄'} ${escapeHtml(c.name)}</span>`).join("") + `</div>`
  }
  // Sıra düzeltildi: Tool üstte, görsel en altta (doğal akış: üstte işlem, altta sonuç)
  div.innerHTML = `<div class="avatar">${avatar}</div><div class="bubble">${imgHtml}${chipsHtml}${thinkingHtml}${toolHtml}<p>${html}</p></div>`
  chat.appendChild(div)
  if(role==="user") chat.scrollTop = chat.scrollHeight
  else {
    // Image varsa direkt en alta kaydır (tool altta kalma sorunu çözümü)
    const hasPollinations = html.includes("image.pollinations.ai") || toolHtml.includes("image.pollinations.ai")
    if(hasPollinations) chat.scrollTop = chat.scrollHeight
    else autoScroll()
  }
  // Copy code buttons
  div.querySelectorAll(".copy-code").forEach(btn=>{
    btn.onclick = ()=>{
      try{
        const code = decodeURIComponent(btn.dataset.code || "")
        navigator.clipboard.writeText(code).then(()=>{
          const old = btn.textContent
          btn.textContent = "✅ Copied"
          setTimeout(()=> btn.textContent = old, 1500)
        })
      }catch{}
    }
  })
  // Message copy for assistant
  if(role==="assistant"){
    const bubble = div.querySelector(".bubble")
    if(bubble){
      bubble.style.position = "relative"
      const copyBtn = document.createElement("button")
      copyBtn.className = "btn small ghost msg-copy"
      copyBtn.textContent = "📋"
      copyBtn.title = "Messageı kopyala"
      copyBtn.onclick = ()=>{
        navigator.clipboard.writeText(content || "")
        copyBtn.textContent="✅"
        setTimeout(()=> copyBtn.textContent="📋",1500)
      }
      bubble.appendChild(copyBtn)
    }
  }
}
function escapeHtml(s){ 
  if(!s) return ""
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;") 
}

async function send(){
  // URL'leri otomatik çipe çevir (input uzamasın)
  const rawBeforeUrl = promptEl.value.trim()
  const urlsInInput = rawBeforeUrl.match(/https?:\/\/[^\s"']+/g)
  if(urlsInInput) urlsInInput.forEach(u=> addUrlChip(u))
  let text = promptEl.value.trim()
  const hasFiles = selectedFiles.length>0
  const hasImage = !!attachedImage
  if(!text && !hasImage && !hasFiles) return
  if(!text && hasImage) text = "Analyze this image in detail."
  if(!text && hasFiles) text = "Analyze selected files"

  if(thinkToggle.checked && !text.startsWith("/think") && !text.startsWith("/no_think")) text = "/think " + text

  const userImages = attachedImage ? [attachedImage.base64] : undefined
  const displayImage = attachedImage ? attachedImage.dataUrl : null
  const chipsForDisplay = [...selectedFiles]
  // File/URL içeriklerini AI için hazırla — input kısa kalır, chip ile gösterilir
  let enhancedText = text
  if(selectedFiles.length){
    const contexts = []
    for(const f of selectedFiles){
      if(f.type==='file'){
        try{
          const r = await fetch("/api/read-file",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({path: f.path})})
          const j = await r.json()
          if(j.ok) contexts.push(`File: ${f.path}\n\`\`\`\n${j.content.slice(0,8000)}\n\`\`\``)
        }catch{}
      } else if(f.type==='url'){
        try{
          const r = await fetch("/api/fetch-url",{method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({url: f.url})})
          const j = await r.json()
          if(j.ok) contexts.push(`URL: ${f.url}\n${j.content.slice(0,6000)}`)
        }catch{}
      }
    }
    if(contexts.length) enhancedText = contexts.join("\n\n---\n\n") + "\n\nUser question: " + text
  }
  const displayText = rawBeforeUrl.replace(/https?:\/\/[^\s"']+/g, "").trim() || (hasFiles ? chipsForDisplay.map(c=>c.name).join(", ") : "🖼️ Image gönderildi")
  addMsg("user", displayText, {image: displayImage, chips: chipsForDisplay})

  const userMsg = { role:"user", content: enhancedText }
  if(userImages) userMsg.images = userImages
  messages.push(userMsg)
  updateCtx(); updateHistory(); saveChat(); try{ updateConversationTitle() }catch{}

  promptEl.value=""; promptEl.style.height="44px"; $("#charCount").textContent=""
  clearImage()
  clearFileChips()

  let typing = document.createElement("div")
  typing.className="msg assistant"
  typing.innerHTML=`<div class="avatar">Q</div><div class="bubble">⏳ Writing...</div>`
  chat.appendChild(typing); autoScroll()
  abortController = new AbortController()
  isGenerating = true
  sendBtn.style.display = "none"
  if(stopBtn) stopBtn.style.display = ""
  sendBtn.disabled=true; sendBtn.textContent="…"

  const model = modelSelect.value
  const numCtx = parseInt(ctxSelect.value)
  const temp = parseFloat(tempRange.value)
  const tools = getTools()

  try{
    const MAX_ITER = 5
    let toolResultsAll = []
    let lastThinking = ""
    let lastData = null
    let iter = 0
    let finalContent = ""
    let finalThinking = ""

    // messages geçmişi klon - tool loop boyunca güncellenecek
    let loopMessages = [...messages]

    const isSmith = smithToggle && smithToggle.checked
    if(isSmith){
      const smithHint = " [Smith Otonom: Hata olursa kum havuzunda test et ve düzelt, gerekirse edit_file ile düzelt, 3 fazda çalış: Context→Action→Verify]"
      const lastIdx = loopMessages.length - 1
      if(lastIdx >= 0 && loopMessages[lastIdx].role === "user" && !loopMessages[lastIdx].content.includes("[Smith")){
        loopMessages[lastIdx].content += smithHint
        messages[messages.length - 1].content += smithHint
      }
      typing.innerHTML = `<div class="avatar">Q</div><div class="bubble"><div style="font-size:11px;color:var(--accent);margin-bottom:6px;display:flex;align-items:center;gap:6px">🤖 Smith • <span style="color:var(--muted)">Context → Action → Verify</span> <span style="margin-left:auto;font-size:10px;background:rgba(99,102,241,.15);padding:2px 6px;border-radius:99px;color:var(--accent)">OTONOM</span></div>⏳ Writing...</div>`
    }

    const useStream = $("#streamToggle") ? $("#streamToggle").checked : true
    let keepTyping = false
    let lastToolCalls = []
    while(iter < MAX_ITER){
      iter++
      let body = { model, messages: loopMessages, stream: useStream, options:{ num_ctx:numCtx, temperature: temp }}
      if(tools.length) body.tools = tools

      let data
      let content = ""
      let thinking = ""
      let toolCalls = []
      if(!useStream){
        let res = await fetch(`${OLLAMA}/api/chat`, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body), signal: abortController.signal})
        if(!res.ok) throw new Error(await res.text())
        data = await res.json()
        lastData = data
        content = data.message.content || ""
        thinking = data.message.thinking || ""
        toolCalls = data.message.tool_calls || []
        if(thinking) lastThinking = thinking
      } else {
        // === STREAMING ===
        let res = await fetch(`${OLLAMA}/api/chat`, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body), signal: abortController.signal})
        if(!res.ok) throw new Error(await res.text())
        const reader = res.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ""
        let fullContent = ""
        let fullThinking = ""
        let accToolCalls = []
        let lastChunk = null
        // typing bubble'ı streaming için hazırla
        const bubbleEl = typing.querySelector(".bubble")
        const updateStreamUI = () => {
          let html = ""
          if(fullThinking){
            html += `<details class="thinking" open><summary>💭 Thinking... (${fullThinking.length} karakter) • canlı</summary><div style="white-space:pre-wrap;margin-top:6px">${escapeHtml(fullThinking.slice(-2500))}</div></details>`
          }
          if(fullContent){
            html += `<p>${escapeHtml(fullContent).replace(/\n/g,"<br>")}<span class="stream-cursor"></span></p>`
          } else {
            html += `<p style="color:var(--muted);font-size:12px">${fullThinking ? "Thinking..., cevap hazırlanıyor..." : "⏳ Writing..."}<span class="stream-cursor"></span></p>`
          }
          bubbleEl.innerHTML = html
          autoScroll()
        }
        // initial
        bubbleEl.innerHTML = `<p style="color:var(--muted)">⏳ Writing...</p>`
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
              if(chunk.message){
                if(chunk.message.content){
                  fullContent += chunk.message.content
                  updateStreamUI()
                }
                if(chunk.message.thinking){
                  fullThinking += chunk.message.thinking
                  updateStreamUI()
                }
                if(chunk.message.tool_calls){
                  accToolCalls = chunk.message.tool_calls
                }
              }
              if(chunk.done){
                lastChunk = chunk
              }
            }catch(e){ /* ignore parse error */ }
          }
        }
        // kalan buffer
        if(buffer.trim()){
          try{
            const chunk = JSON.parse(buffer)
            if(chunk.message){
              if(chunk.message.content) fullContent += chunk.message.content
              if(chunk.message.thinking) fullThinking += chunk.message.thinking
              if(chunk.message.tool_calls) accToolCalls = chunk.message.tool_calls
            }
            lastChunk = chunk
          }catch{}
        }
        data = {
          message: { content: fullContent, thinking: fullThinking, tool_calls: accToolCalls },
          ...lastChunk
        }
        lastData = data
        content = fullContent
        thinking = fullThinking
        toolCalls = accToolCalls
        if(thinking) lastThinking = thinking
        // stream bitti, bubble'ı son haline getir (cursor kaldır)
        // typing elementi bir sonraki adımda remove edilecek veya tool varsa güncellenecek
      }

      lastToolCalls = toolCalls
      if(toolCalls.length === 0){
        // tool yok -> final cevap
        if(useStream){
          // streaming'de typing zaten canlı içeriği gösteriyor, sadece final formata çevir (cursor kaldır, markdown uygula)
          let html = content || "(boş cevap)"
          html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (m,lang,code)=> renderCodeEditor(lang||"", code))
          html = html.replace(/`([^`]+)`/g, "<code>$1</code>")
          // Image markdown ![alt](url) -> <img>
          html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m, alt, url)=>{
            const safeAlt = escapeHtml(alt)
            const safeUrl = url.replace(/"/g, "&quot;")
            return `<div style="margin:10px 0"><img src="${safeUrl}" alt="${safeAlt}" style="max-width:100%;max-height:520px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:block" loading="lazy" onerror="this.style.display='none'"><div style="font-size:11px;color:var(--muted2);margin-top:4px">🎨 ${safeAlt} • <a href="${safeUrl}" target="_blank" style="color:var(--accent)">Open full size</a></div></div>`
          })
          html = html.replace(/(?<!["'=\(])(https?:\/\/image\.pollinations\.ai\/prompt\/[^\s<"]+)/g, (m, url)=>{
            if(html.includes(`src="${url}"`)) return m
            return `<div style="margin:10px 0"><img src="${url}" style="max-width:100%;max-height:520px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:block" loading="lazy"><div style="font-size:11px;color:var(--muted2);margin-top:4px"><a href="${url}" target="_blank" style="color:var(--accent)">🔗 ${url.slice(0,60)}...</a></div></div>`
          })
          html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
          html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>")
          html = html.replace(/(?<!["'=\(])(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" style="color:var(--accent)">$1</a>')
          // renderCodeEditor zaten blok, kalan \n'leri <br> yap ama editor içindeki \n'leri bozma
          // Bu yüzden sadece editor dışındaki \n'leri çevir — basit: editor blokları geçici placeholder ile koru
          // (renderCodeEditor zaten kendi içinde <div> kullanıyor, son <br> eklemiyoruz)
          html = html.replace(/\n/g, "<br>")
          let thinkingHtml = ""
          const th = thinking || lastThinking
          if(th){
            thinkingHtml = `<details class="thinking"><summary>💭 Thinking process (${th.length} karakter)</summary><div style="white-space:pre-wrap;margin-top:6px">${escapeHtml(th)}</div></details>`
          }
          // Eğer generate_image kullanıldıysa ve model görseli eklemediyse, biz ekleyelim
          const pollinationsUrls = toolResultsAll.map(r=> String(r).match(/https?:\/\/image\.pollinations\.ai\/prompt\/[^\s"']+/)?.[0]).filter(Boolean)
          if(pollinationsUrls.length && !html.includes("image.pollinations.ai")){
            const imgs = pollinationsUrls.map(u=> `<div style="margin:12px 0"><img src="${u}" style="max-width:100%;max-height:520px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:block" loading="lazy" onerror="this.style.display='none'"><div style="font-size:11px;color:var(--muted);margin-top:4px">🎨 Oluşturulan görsel • <a href="${u}" target="_blank" style="color:var(--accent)">Open full size</a></div></div>`).join("")
            html += imgs
          }
          let toolResultHtml = ""
          if(toolResultsAll.length > 0){
            // Image varsa toolResult'ta tekrar büyük görsel gösterme, sadece küçük meta göster
            const hasPollinations = pollinationsUrls.length>0
            if(hasPollinations){
              // Zaten html'e ekledik, toolResult'ta sadece metin göster
              toolResultHtml = `<div class="meta" style="border-color:#22c55e;font-size:11px"><b>✅ Generate imageildi</b> • ${pollinationsUrls.length} görsel • <a href="${pollinationsUrls[0]}" target="_blank" style="color:var(--accent)">Link</a></div>`
            } else {
              toolResultHtml = `<div class="meta" style="border-color:#22c55e"><b>✅ Tool Sonuçları:</b><br>${toolResultsAll.map(r=> escapeHtml(r)).join("<br><br>")}</div>`
            }
          }
          const bubbleEl = typing.querySelector(".bubble")
          // Sıra düzeltildi: Tool üstte, görsel en altta -> alta kaydırınca görsel görülür
          bubbleEl.innerHTML = `${thinkingHtml}${toolResultHtml}<p>${html}</p>`
          // Image varsa direkt en alta kaydır
          if(pollinationsUrls.length) setTimeout(()=> chat.scrollTop = chat.scrollHeight, 80)
          keepTyping = true
        } else {
          typing.remove()
          if(toolResultsAll.length > 0){
            addMsg("assistant", content || "(boş cevap)", {thinking: thinking || lastThinking, toolResults: toolResultsAll})
          } else {
            addMsg("assistant", content, {thinking, toolCalls})
          }
        }
        loopMessages.push({role:"assistant", content})
        finalContent = content
        finalThinking = thinking
        break
      }

      // Tool var -> calistir
      // streaming'de typing içeriği tool bilgisiyle değiştir, yeni typing oluşturma
      typing.innerHTML=`<div class="avatar">Q</div><div class="bubble">🔧 Running tools... (iter ${iter}: ${toolCalls.length} tool)</div>`

      // Ollama spec: önce assistant tool_calls messagesı, sonra tool messagesları
      const assistantToolMsg = { role:"assistant", content: content || "", tool_calls: toolCalls }
      loopMessages.push(assistantToolMsg)

      let iterResults = []
      for(const tc of toolCalls){
        const result = await executeToolCall(tc)
        iterResults.push(result)
        toolResultsAll.push(result)
        loopMessages.push({ role:"tool", content: String(result) })
      }

      // ara messages olarak goster
      if(iter === 1){
        try{ typing.remove() }catch{}
        addMsg("assistant", content || "Araçlar çalıştırıldı...", {thinking, toolCalls, toolResults: iterResults})
        // yeni typing for next iter - streaming için doğru referansı sakla
        const nextTyping = document.createElement("div")
        nextTyping.className="msg assistant"
        nextTyping.id = "typing-loop"
        nextTyping.innerHTML=`<div class="avatar">Q</div><div class="bubble">⏳ Evaluating results... (iter ${iter+1})</div>`
        chat.appendChild(nextTyping); autoScroll()
        typing = nextTyping
      } else {
        // intermediate tool call göster
        addMsg("assistant", `🔧 Iter ${iter} tool sonuçları:`, {toolCalls, toolResults: iterResults})
        const el=document.getElementById("typing-loop")
        if(el) el.innerHTML=`<div class="avatar">Q</div><div class="bubble">⏳ Evaluating results... (iter ${iter+1})</div>`
        // typing zaten nextTyping'i gösteriyor, el ile aynı
      }

      // eger son iter'de toolCalls bittiyse loop devam edecek ve final cevabi alacak
      // typing'i koru, next fetch yap
      finalContent = content
      finalThinking = thinking
      // loop devam
      if(iter === MAX_ITER){
        const el=document.getElementById("typing-loop")
        if(el) el.remove()
        typing.remove()
        addMsg("assistant", "⚠️ Max tool iterations reached", {toolResults: toolResultsAll})
        break
      }
    }

    // loop bitti -> messages gecmisini guncelle
    messages = loopMessages
    saveChat()

    // Smith Verify fazı: dosya yazıldıysa kum havuzunda test et
    if(isSmith && toolResultsAll.length>0){
      const written = toolResultsAll.filter(r=> r.includes("Written to") || r.includes("Edited") || r.includes("Created") || r.includes("Created directory")).slice(0,1)
      if(written.length){
        try{
          const m = written[0].match(/(?:Written to|Edited|Created)[^\n]*?([^\s\\/:]+\.(?:py|js|ts|txt|md|html|css|json|jsx|tsx))/i)
          const fname = m ? m[1] : (written[0].match(/([^\s]+\.\w+)/)?.[1] || "test.py")
          if(fname){
            const sRes = await fetch("/api/run-sandbox", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({filename: fname})})
            const sj = await sRes.json()
            if(sj.ok){
              addMsg("assistant", `✅ Smith Verify: Sandbox success • \`${fname}\` sorunsuz çalıştı`, {})
            } else {
              addMsg("assistant", `⚠️ Smith Verify: Sandbox error • \`${fname}\`\n\`\`\`\n${(sj.error||sj.output||"").slice(0,600)}\n\`\`\`\nSmith otomatik düzeltme öneriyor.`, {})
            }
            updateHistory()
          }
        }catch{}
      }
    }

    // eger hiç tool yoksa ve loop tek iter'de bittiyse zaten eklendi
    // eger tool vardı ve loop ile final alındı, son assistant messagesi zaten eklendi mi kontrol et
    // STREAMING FIX: eğer streaming ile final cevap typing içinde gösterildiyse silme
    const isStreamingFinal = keepTyping
    if(!isStreamingFinal){
      const lastLoop = document.getElementById("typing-loop")
      if(lastLoop) lastLoop.remove()
      try{ typing.remove() }catch{}
    } else {
      // streaming finalde typing artık kalıcı messages, sadece id temizle ve bırak
      try{ typing.removeAttribute("id") }catch{}
      const leftover = document.getElementById("typing-loop")
      if(leftover && leftover !== typing) leftover.remove()
    }

    // Son final messagesi eger tool ile bittiyse zaten eklendi, ama tool yoksa da eklendi
    // Eger tool vardi ve final tool'suz cevap alındıysa, o cevap zaten addMsg ile eklendi
    // Ekstra final messagesi ekleme gerek yok, ama history icin garanti:
    if(toolResultsAll.length > 0 && finalContent && !messages.some(m=> m.role==="assistant" && m.content===finalContent)){
      // zaten eklendi, skip
    }

    updateCtx(); updateHistory()
    const totalDuration = lastData ? (lastData.total_duration/1e9).toFixed(1) : "?"
    const evalCount = lastData ? (lastData.eval_count||"?") : "?"
    lastMeta.innerHTML = `<b>Model:</b> ${model}<br><b>Süre:</b> ${totalDuration}s<br><b>Tokens:</b> ${evalCount} • <b>Thinking:</b> ${finalThinking? finalThinking.length+" char": lastThinking? lastThinking.length+" char":"yok"}<br><b>Tools:</b> ${toolResultsAll.length} sonuç (${iter} iter)`
    connStatus.textContent="● Connected"; connStatus.style.color="#22c55e"
    // dosyalar panelini guncelle
    if(toolResultsAll.length){
      for(const r of toolResultsAll.slice(0,2)){
        if(r.includes("Written to")){
          const m = r.match(/Written to (.+?) \(/)
          if(m) {
            savedFiles.unshift({name: m[1].split("\\").pop(), content: r.slice(0,200), time: Date.now()})
          }
        }
      }
      localStorage.setItem("qwen-files", JSON.stringify(savedFiles.slice(0,20)))
      renderQuickFiles()
    }
  }catch(e){
    const isAbort = e.name === "AbortError" || (e.message && e.message.includes("aborted")) || String(e).includes("AbortError")
    if(isAbort){
      try{ typing.remove() }catch{}
      const el=document.getElementById("typing-loop"); if(el) el.remove()
      // Stopped messagesı zaten stopBtn handler'ında gösterildiyse tekrar gösterme
      if(!document.body.textContent.includes("Stopped")){
        addMsg("assistant", "⏹ *Stopped — cancelled by user*")
      }
      connStatus.textContent="● Stopped"; connStatus.style.color="#f59e0b"
    } else {
      try{ typing.remove() }catch{}
      const el=document.getElementById("typing-loop"); if(el) el.remove()
      let msg = e.message || String(e)
      let friendly = "❌ Hata: " + msg
      if(msg.includes("0xc0000409") || msg.includes("stack-based buffer") || msg.includes("CUDA error") || msg.includes("llama-server")){
        friendly = `❌ **Model crashed (CUDA / Bellek hatası)**\n\n\`\`\`\n${msg.slice(0,500)}\n\`\`\`\n\n**Suggested fixes:**\n• Reduce context: \`num_ctx\` 32K → **8K** yap\n• Thinking'i **OFF** yap (hızlı mod)\n• Daha küçük model dene: \`qwen2.5-coder:7b\` veya \`llama3.1:8b\`\n• Ollama'yı yeniden başlat: CMD'de \`ollama serve\` ve \`nvidia-smi\` kontrol et\n• Hala oluyorsa: \`ollama create qwen35-agent -f Modelfile\` ile modeli yeniden oluştur`
      }
      addMsg("assistant", friendly)
      connStatus.textContent="● Hata"; connStatus.style.color="#ef4444"
    }
  }finally{
    isGenerating = false
    abortController = null
    sendBtn.disabled=false; sendBtn.textContent="▶"
    sendBtn.style.display = ""
    if(stopBtn) stopBtn.style.display = "none"
  }
}

function updateHistory(){
  if(messages.length===0){ historyEl.innerHTML='<div class="empty">No messages yet</div>'; return }
  historyEl.innerHTML = messages.slice(-12).reverse().map(m=>{
    const icon = m.role==="user" ? "Sen" : m.role==="tool" ? "🔧 Tool" : "Agent"
    return `<div class="history-item"><div class="h-title">${icon}: ${m.content.slice(0,42).replace(/\n/g," ")}</div><div class="h-sub">${estimateTokens(m.content)} token ${m.images?"• 🖼️":""}</div></div>`
  }).join("")
}

async function checkConn(){
  try{
    const r = await fetch(`${OLLAMA}/api/tags`); if(!r.ok) throw 0
    connStatus.textContent="● Connected"; connStatus.style.color="#22c55e"
  }catch{ connStatus.textContent="● Connected değil"; connStatus.style.color="#ef4444" }
}
checkConn(); setInterval(checkConn, 5000)

modelSelect.onchange = ()=>{
  const v = modelSelect.value
  const map = {
    "qwen35-agent":"256K • Vision • Thinking • Tools ★",
    "qwen3.5:9b":"256K • Vision • 6.6GB",
    "qwen2.5-coder:7b":"32K • Kod Uzmanı • 4.7GB",
    "llama3.1:8b-instruct-q4_K_M":"128K • Genel • 4.9GB",
    "dolphin-llama3:8b":"8K • Sansürsüz • 4.7GB",
  }
  $("#modelInfo").textContent = map[v] || ""
  const hm = $("#headerModel")
  if(hm) hm.textContent = v
}
// Header model initial
try{ const hm=$("#headerModel"); if(hm) hm.textContent = modelSelect.value }catch{}

// Export / Import & Kalıcılık
const exportBtn = $("#exportBtn"), importBtn = $("#importBtn"), importFileEl = $("#importFile")
if(exportBtn){
  exportBtn.onclick = ()=>{
    if(messages.length===0) return alert("No messages to export")
    const data = JSON.stringify(messages, null, 2)
    const blob = new Blob([data], {type:"application/json"})
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href=url; a.download=`qwen-chat-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
}
if(importBtn && importFileEl){
  importBtn.onclick = ()=> importFileEl.click()
  importFileEl.onchange = async ()=>{
    const f = importFileEl.files[0]; if(!f) return
    try{
      const text = await f.text()
      const data = JSON.parse(text)
      if(!Array.isArray(data)) throw new Error("Invalid format")
      messages = data
      chat.innerHTML=""
      for(const m of messages){
        if(m.role==="user") addMsg("user", m.content, {})
        else if(m.role==="assistant") addMsg("assistant", m.content, {toolCalls: m.tool_calls, thinking: m.thinking})
        else if(m.role==="tool") addMsg("assistant", `🔧 Tool: ${String(m.content).slice(0,300)}`, {})
      }
      updateCtx(); updateHistory(); saveChat()
      lastMeta.textContent = `Imported: ${messages.length} messages`
    }catch(e){ alert("Import error: "+e.message) }
    importFileEl.value=""
  }
}
// Yeni Chat butonları
for(const id of ["newChatBtn","newChatBtn2","headerNewChatBtn"]){
  const btn = document.getElementById(id)
  if(btn) btn.onclick = createNewChat
}
try{ renderConversationList() }catch{}
try{
  if(conversations.length===0){
    // Eski tekli sohbet varsa onu çokluya taşı
    const oldRaw = localStorage.getItem("qwen-chat")
    if(oldRaw){
      try{
        const oldMsgs = JSON.parse(oldRaw)
        if(Array.isArray(oldMsgs) && oldMsgs.length>0){
          const id = Date.now().toString(36)
          conversations = [{id, title: oldMsgs.find(m=>m.role==="user")?.content?.slice(0,40) || "Chat", messages: oldMsgs, createdAt: Date.now(), updatedAt: Date.now()}]
          activeId = id
          saveConversations()
        }
      }catch{}
    }
    // Hala boşsa varsayılan oluştur
    if(conversations.length===0){
      const id = Date.now().toString(36)
      conversations = [{id, title: "Yeni Chat", messages: [], createdAt: Date.now(), updatedAt: Date.now()}]
      activeId = id
      saveConversations()
    }
  }
  if(conversations.length>0 && activeId){
    const conv = conversations.find(c=>c.id===activeId)
    if(conv){
      if(messages.length===0 && conv.messages.length>0){
        messages = [...conv.messages]
        chat.innerHTML=""
        for(const m of messages){
          if(m.role==="user") addMsg("user", m.content, {})
          else if(m.role==="assistant") addMsg("assistant", m.content, {toolCalls: m.tool_calls, thinking: m.thinking})
          else if(m.role==="tool") addMsg("assistant", `🔧 ${String(m.content).slice(0,300)}`, {})
        }
        updateCtx(); updateHistory()
      } else if(messages.length===0){
        // Aktif sohbet boş, zaten welcome gösteriliyor
      }
    }
  } else {
    loadChat()
  }
  renderConversationList()
}catch(e){ console.warn("init chat fail", e); try{ loadChat() }catch{} }
