/**
 * Book Writing Tool - Professional Book Layout System
 * 
 * Automatically when user says "write book":
 * - Page layout (A5, margins, page numbers)
 * - Structure (chapters, sub-chapters, pagination)
 * - Text positioning (alignment, line spacing, font)
 * - Persistence (continue in new chat)
 * 
 * All books: A:\AI\qwen35-agent-test-workspace\Kitaplar\
 */

import type { Tool } from "./agent"

// ── Tipler ──
export interface SayfaAyarlari {
  boyut: "A5" | "A4" | "cep"
  yon: "dikey" | "yatay"
  kenarBosluk: { ust: string; alt: string; ic: string; dis: string }
  font: string
  fontBoyutu: string
  satirAraligi: number
  hizalama: "justify" | "left" | "center"
  sayfaNumarasi: "alt-orta" | "alt-dis" | "ust-dis" | "yok"
  bolumBaslangici: "sag-sayfa" | "her-sayfa" | "ardisik"
}

export interface Bolum {
  id: string
  baslik: string
  ozet?: string
  durum: "planlandi" | "yaziliyor" | "tamamlandi" | "duzenlendi"
  sayfaAraligi?: string
  kelimeSayisi: number
  dosya: string
  sira: number
}

export interface Kitap {
  baslik: string
  yazar: string
  tur: string
  dil: string
  olusturmaTarihi: string
  sonGuncelleme: string
  durum: "taslak" | "yaziliyor" | "tamamlandi" | "duzenlendi"
  sayfaAyarlari: SayfaAyarlari
  bolumler: Bolum[]
  toplamSayfa: number
  toplamKelime: number
  ozet?: string
  kapakRenk?: string
}

// ── Varsayılan Sayfa Ayarları (Profesyonel Kitap Düzeni) ──
export const varsayilanSayfaAyarlari: SayfaAyarlari = {
  boyut: "A5",
  yon: "dikey",
  kenarBosluk: { ust: "20mm", alt: "20mm", ic: "18mm", dis: "15mm" },
  font: "Noto Serif",
  fontBoyutu: "10pt",
  satirAraligi: 1.5,
  hizalama: "justify",
  sayfaNumarasi: "alt-orta",
  bolumBaslangici: "sag-sayfa",
}

// ── Tool Tanımları ──
export const bookTools: Tool[] = [
  {
    type: "function",
    function: {
      name: "book_create",
      description: "CREATE NEW BOOK - Use AUTOMATICALLY when user says 'write book', 'new book', 'write novel', 'write story', '3-page book', 'fantasy book'. Creates a complete book project with professional page layout (A5, margins, page numbers), structure (chapters), and text positioning. If page count is specified (e.g. '3-page'), FILL the sayfaSayisi parameter. Book is stored permanently under Desktop/Kitaplar/ and can be continued in a new chat. IMPORTANT: If user says '3-page pdf' with both length and format, set sayfaSayisi=3 and tur=fantasy, then AUTOMATICALLY write all chapters with book_write and generate PDF with book_generate.",
      parameters: {
        type: "object",
        properties: {
          baslik: { type: "string", description: "Book title (e.g. 'Whispers of Shadows')" },
          yazar: { type: "string", description: "Author name (default: anonymous, optional)" },
          tur: { type: "string", description: "Genre: novel, story, fantasy, self-help, history, science, children, poetry, memoir, travel (default: novel)" },
          ozet: { type: "string", description: "Book topic/summary (2-3 sentences). AI plans chapters from this." },
          bolumSayisi: { type: "number", description: "Number of chapters (default: AI decides by genre, usually 8-12). For short books (3 pages) use 2-3." },
          sayfaSayisi: { type: "number", description: "TARGET PAGE COUNT - Fill when user says '3-page', '5-page', '10-page'. E.g. 3 pages = ~900 words. Tool plans chapters/words accordingly." },
          dil: { type: "string", description: "Language: tr, en (default: tr)" },
        },
        required: ["baslik"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_status",
      description: "GET BOOK STATUS - List existing books, current chapter, page count, what's next. Use AUTOMATICALLY for 'continue where I left off' in a new chat. DIRECTORY SUPPORTED: you can pass full directory path instead of title (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari).",
      parameters: {
        type: "object",
        properties: {
          kitapAdi: { type: "string", description: "Book title, folder name OR full directory path (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari). Empty = list all books" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_add_chapter",
      description: "ADD CHAPTER - Add a new chapter to the book. DIRECTORY SUPPORTED: you can pass full directory path instead of title.",
      parameters: {
        type: "object",
        properties: {
          kitapAdi: { type: "string", description: "Book title OR full directory path" },
          baslik: { type: "string", description: "Chapter title (e.g. '1. Chapter: Beginning')" },
          ozet: { type: "string", description: "Chapter summary" },
        },
        required: ["kitapAdi", "baslik"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_write",
      description: "WRITE BOOK / CONTINUE - Write content to a specific chapter or continue where you left off. Text is automatically positioned (alignment, line spacing, hyphenation), page numbers updated. DIRECTORY SUPPORTED: you can pass full directory path instead of title (for continuing in a new chat via directory).",
      parameters: {
        type: "object",
        properties: {
          kitapAdi: { type: "string", description: "Book title OR full directory path (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\MyBook)" },
          bolumId: { type: "string", description: "Chapter ID (e.g. bolum-01). Empty = next chapter to write" },
          icerik: { type: "string", description: "Content to write. Empty = AI continues automatically (based on chapter summary)" },
          konum: { type: "string", description: "Position: baslangic/start, orta/middle, son/end, devam/continue (default: devam)" },
        },
        required: ["kitapAdi"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_generate",
      description: "GENERATE BOOK - Combine all chapters with professional page layout: cover, table of contents (with page numbers), chapters (start on right page), page numbers, justification. Supports html/pdf/docx/epub. DIRECTORY SUPPORTED.",
      parameters: {
        type: "object",
        properties: {
          kitapAdi: { type: "string", description: "Book title OR full directory path" },
          format: { type: "string", enum: ["html", "pdf", "docx", "epub", "hepsi", "her-ikisi"], description: "Output format: html, pdf, docx (Word), epub (e-book), hepsi (all). Default: hepsi" },
        },
        required: ["kitapAdi"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_extend",
      description: "EXTEND BOOK - Continue an existing book from where you left off, ADD PAGES. Use AUTOMATICALLY when user in a new chat gives a directory and says 'add 2 pages', 'continue where I left off, write 3 more pages'. DIRECTORY SUPPORTED: full path or title. Qwen automatically writes new chapters and extends page count. Ex: book_extend(kitapYolu=\"A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari\", ekSayfa=2)",
      parameters: {
        type: "object",
        properties: {
          kitapYolu: { type: "string", description: "Book title OR full directory path (e.g. A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Roma-nin-Sirlari or just Roma'nın Sırları). Use directory if user provides it in new chat" },
          ekSayfa: { type: "number", description: "Number of pages to add (e.g. 2). 1 page ~280 words" },
          ekOzellik: { type: "string", description: "Optional extra topic/summary (e.g. 'new mystery in Pantheon')" },
        },
        required: ["kitapYolu", "ekSayfa"],
      },
    },
  },
]

// ── Yardımcılar ──
const KITAPLAR_KLASORU = "A:\\AI\\qwen35-agent-test-workspace\\Kitaplar"

function kitapKlasoru(baslik: string): string {
  const guvenli = baslik.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").slice(0, 50)
  return `${KITAPLAR_KLASORU}\\${guvenli}`
}

// Yeni sohbette dizin ile devam için çözümleyici: başlık, slug veya tam dizin yolu
async function cozumleKitapKlasoru(
  identifier: string,
  fs: typeof import("node:fs/promises"),
  pathMod: typeof import("node:path")
): Promise<string> {
  if (!identifier) throw new Error("Kitap dizini/adı gerekli")
  let id = identifier.trim().replace(/^["']|["']$/g, "")

  // Tam dizin yolu mu? (C:\..., /..., \..., Kitaplar\...)
  const isAbsolute = /^[A-Za-z]:[\\/]/.test(id) || id.includes("Kitaplar") || id.includes("/") || id.includes("\\")
  if (isAbsolute) {
    // kitap.json ile bitiyorsa klasöre indir
    if (id.toLowerCase().endsWith("kitap.json")) id = pathMod.dirname(id)
    if (id.toLowerCase().endsWith("kitap.html")) id = pathMod.dirname(id)
    // trailing slash temizle
    id = id.replace(/[\\/]+$/, "")
    try {
      const stat = await fs.stat(id)
      if (stat.isDirectory()) {
        // içinde kitap.json var mı?
        try { await fs.access(pathMod.join(id, "kitap.json")); return id } catch {}
        // yoksa belki slug hatası, yine de döndür
        return id
      }
    } catch {}
    // mutlak yol ama bulamadıysa slug'a düş
  }

  // 1) Slug olarak dene
  const slugYol = kitapKlasoru(id)
  try { await fs.access(pathMod.join(slugYol, "kitap.json")); return slugYol } catch {}

  // 2) Başlığa göre tüm kitapları tara
  try {
    const klasorler = await fs.readdir(KITAPLAR_KLASORU)
    for (const k of klasorler) {
      try {
        const d = await fs.readFile(pathMod.join(KITAPLAR_KLASORU, k, "kitap.json"), "utf-8")
        const j = JSON.parse(d) as Kitap
        if (j.baslik.toLowerCase() === id.toLowerCase() || k.toLowerCase() === id.toLowerCase() || k.toLowerCase() === id.replace(/\s+/g,"-").toLowerCase()) {
          return pathMod.join(KITAPLAR_KLASORU, k)
        }
      } catch {}
    }
  } catch {}

  // 3) Fallback: slug yolu döndür (yeni kitap değilse hata verecek zaten)
  return slugYol
}

function kelimeSayisi(metin: string): number {
  return metin.trim().split(/\s+/).filter(Boolean).length
}

function sayfaHesapla(kelime: number): number {
  return Math.max(1, Math.ceil(kelime / 280))
}

function baslikTemizle(baslik: string): string {
  return baslik
    .replace(/^\d+\.\s*Bölüm\s*:?\s*/i, "")
    .replace(/^Bölüm\s*\d+\s*:?\s*/i, "")
    .trim()
}

function icerikTemizle(ham: string): string {
  let t = ham
  // <think>...</think> bloklarını sil
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "")
  t = t.replace(/<think>[\s\S]*/gi, "")
  t = t.replace(/<\/think>/gi, "")
  // Duplicate meta açıklamaları sil
  t = t.replace(/Bu b.*?m daha k.*?sa oldu.*?(?=Sihirli|Roman|Leo|Elara|\n\n)/gi, "")
  t = t.replace(/Tam metin.*?:\s*---/gi, "")
  t = t.replace(/^---+\s*$/gm, "")
  t = t.replace(/\r\n/g, "\n")
  t = t.replace(/\n{3,}/g, "\n\n")
  t = t.trim()

  // Tekrarlayan paragraf/cümle temizleme (LLM loop fix) - paragraf seviyesinde
  const paragraflar = t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  if (paragraflar.length >= 3) {
    const gorulenParagraf = new Set<string>()
    const temizParagraflar: string[] = []
    for (const p of paragraflar) {
      const key = p.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100)
      if (key.length < 30) { temizParagraflar.push(p); continue }
      if (gorulenParagraf.has(key)) continue
      // İlk 50 karakteri aynı olan paragraf tekrar sayılır
      let isDup = false
      for (const g of gorulenParagraf) {
        if (key.slice(0, 50) === g.slice(0, 50)) { isDup = true; break }
      }
      if (isDup) continue
      gorulenParagraf.add(key)
      temizParagraflar.push(p)
    }
    // Sadece %40'tan fazla kırpma olduysa güvenlik için orijinali koru
    if (temizParagraflar.length >= paragraflar.length * 0.5) {
      t = temizParagraflar.join("\n\n")
    }
  }
  // Cümle seviyesinde bariz tekrar (aynı cümle 3+ kez) - sadece tam eşleşme
  const cumleler = t.split(/(?<=[.!?])\s+/)
  if (cumleler.length > 10) {
    const say: Record<string, number> = {}
    for (const c of cumleler) {
      const k = c.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80)
      if (k.length < 25) continue
      say[k] = (say[k] || 0) + 1
    }
    const tekrarliCumleler = new Set(Object.entries(say).filter(([, v]) => v >= 3).map(([k]) => k))
    if (tekrarliCumleler.size > 0) {
      const filtre: string[] = []
      const seenRepeat = new Set<string>()
      for (const c of cumleler) {
        const k = c.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80)
        if (tekrarliCumleler.has(k)) {
          if (seenRepeat.has(k)) continue
          seenRepeat.add(k)
        }
        filtre.push(c)
      }
      // Paragraf yapısını korumak için orijinal newline'ları kullanamıyoruz, ama filtre cümleleri paragrafa geri dağıt
      // Güvenlik: sadece 1 cümle tipi tekrar ediyorsa uygula
      if (filtre.length >= cumleler.length * 0.6) {
        // Orijinal paragraf yapısını koruyarak tekrarlı cümleleri sil
        let yeni = t
        for (const k of tekrarliCumleler) {
          // ikinci ve sonraki geçişlerini sil
          let count = 0
          yeni = yeni.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (match) => {
            count++
            return count <= 1 ? match : ""
          })
        }
        yeni = yeni.replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim()
        if (yeni.split(/\s+/).length >= t.split(/\s+/).length * 0.6) t = yeni
      }
    }
  }
  return t.trim()
}

function paragraflaraBol(metin: string): string[] {
  const temiz = icerikTemizle(metin)
  return temiz
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => p.length > 5)
}

// ── Kitap HTML Şablonu (Profesyonel Baskı Düzeni v2 - Kitap Standardı) ──
function kitapHTMLSablonu(kitap: Kitap, bolumIcerikleri: Array<{ bolum: Bolum; icerik: string }>): string {
  const { sayfaAyarlari } = kitap
  const boyutMap = { A5: "148mm 210mm", A4: "210mm 297mm", cep: "110mm 180mm" }

  // Sayfa numaralarını hesapla - kümülatif
  let kumulatifSayfa = 1
  // kapak 1 + künye 1 + içindekiler 1 = 3 sabit
  const icindekilerSayfa = 1
  const onSayfa = 3
  const bolumSayfaBilgisi = bolumIcerikleri.map(({ bolum }) => {
    const kelime = kelimeSayisi(icerikTemizle(bolumIcerikleri.find(b => b.bolum.id === bolum.id)?.icerik || ""))
    const s = Math.max(1, Math.ceil(kelime / 280) || 1)
    const bas = onSayfa + kumulatifSayfa
    kumulatifSayfa += s
    return { bas, s }
  })

  return `<!DOCTYPE html>
<html lang="${kitap.dil}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kitap.baslik} - ${kitap.yazar}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&display=swap');
  
  @page {
    size: ${boyutMap[sayfaAyarlari.boyut]} ${sayfaAyarlari.yon === "yatay" ? "landscape" : "portrait"};
    margin: ${sayfaAyarlari.kenarBosluk.ust} ${sayfaAyarlari.kenarBosluk.dis} ${sayfaAyarlari.kenarBosluk.alt} ${sayfaAyarlari.kenarBosluk.ic};
  }
  
  * { box-sizing: border-box; }
  
  html { background: #ececec; }
  body {
    font-family: 'Crimson Pro','Noto Serif', Georgia, serif;
    font-size: ${sayfaAyarlari.fontBoyutu};
    line-height: ${sayfaAyarlari.satirAraligi};
    color: #1a1a1a;
    text-align: ${sayfaAyarlari.hizalama};
    hyphens: auto;
    -webkit-hyphens: auto;
    hyphenate-limit-chars: 6 3 3;
    orphans: 3;
    widows: 3;
    margin: 0;
    padding: 0;
    background: white;
    counter-reset: page 1;
    -webkit-font-smoothing: antialiased;
  }
  
  /* Kapak - tam sayfa, sayfa numarası YOK */
  .kapak {
    min-height: 88vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: linear-gradient(165deg, #0f0c29 0%, #302b63 45%, #24243e 100%);
    color: white;
    padding: 48px 32px;
    page-break-after: always;
    break-after: page;
    position: relative;
    overflow: hidden;
  }
  .kapak::before{
    content:"";
    position:absolute;
    top:-40%; left:-30%; width:160%; height:80%;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.07) 0%, transparent 70%);
    pointer-events:none;
  }
  .kapak h1 {
    font-family: 'Crimson Pro', serif;
    font-size: 32pt;
    font-weight: 700;
    margin: 0 0 10px 0;
    letter-spacing: -0.8px;
    line-height: 1.05;
    max-width: 90%;
  }
  .kapak .alt-baslik {
    font-size: 10pt;
    letter-spacing: 4px;
    text-transform: uppercase;
    opacity: 0.6;
    margin-bottom: 18px;
    font-family: 'Inter', sans-serif;
  }
  .kapak .yazar {
    font-size: 13pt;
    font-weight: 400;
    opacity: 0.95;
    margin-top: 24px;
    font-style: italic;
    font-family: 'Crimson Pro', serif;
  }
  .kapak .yazar::before{
    content:"—";
    margin-right:8px;
    opacity:0.5;
  }
  .kapak .tur {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 3px;
    opacity: 0.55;
    margin-top: 32px;
    border-top: 1px solid rgba(255,255,255,0.25);
    padding-top: 14px;
    font-family: 'Inter', sans-serif;
  }
  .kapak .kapak-sus{
    margin-top: 28px;
    width: 28px;
    height: 2px;
    background: rgba(255,255,255,0.5);
  }
  
  /* Künye - arka kapak içi */
  .kunye {
    page-break-after: always;
    break-after: page;
    padding: 36px 40px 40px 40px;
    font-size: 7.5pt;
    color: #555;
    line-height: 1.7;
    font-family: 'Inter', sans-serif;
    min-height: 40vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .kunye h2 { font-size: 8pt; letter-spacing:2px; text-transform:uppercase; color:#999; margin:0 0 14px 0; font-weight:600; }
  .kunye strong { color:#1a1a1a; font-family:'Crimson Pro', serif; font-size:10pt; }
  
  /* İçindekiler */
  .icindekiler {
    page-break-after: always;
    break-after: page;
    padding: 10px 0 20px 0;
  }
  .icindekiler h2 {
    font-family: 'Crimson Pro', serif;
    font-size: 16pt;
    text-align: center;
    margin: 0 0 6px 0;
    font-weight: 700;
    letter-spacing: 1px;
    color: #1a1a2e;
  }
  .icindekiler .icindekiler-alt{
    text-align: center;
    font-size: 7pt;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 22px;
    font-family: 'Inter', sans-serif;
  }
  .icindekiler-listesi { list-style: none; padding: 0; margin: 0; }
  .icindekiler-listesi li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 9px 0 8px 0;
    border-bottom: 1px dotted #d8d8d8;
    font-size: 9.2pt;
    line-height: 1.3;
  }
  .icindekiler-listesi li:last-child{ border-bottom:none; }
  .icindekiler-listesi .bolum-no {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    min-width: 78px;
    color: #302b63;
    font-size: 7.8pt;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .icindekiler-listesi .bolum-baslik { flex:1; font-family:'Crimson Pro', serif; font-weight:600; color:#1a1a1a; }
  .icindekiler-listesi .nokta-lider{
    flex: 0 1 auto;
    overflow: hidden;
    color: #ccc;
    letter-spacing: 2px;
    font-size: 7pt;
    margin: 0 4px;
    white-space: nowrap;
  }
  .icindekiler-listesi .sayfa-no {
    min-width: 28px;
    text-align: right;
    color: #666;
    font-variant-numeric: tabular-nums;
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    flex-shrink: 0;
  }
  
  /* Bölümler - profesyonel kitap başı */
  .bolum {
    page-break-before: always;
    break-before: page;
    padding-top: 6px;
    margin-bottom: 28px;
  }
  .bolum:first-of-type{
    break-before: auto;
    page-break-before: auto;
  }
  .bolum-header{
    text-align: center;
    margin: 10px 0 22px 0;
    padding-bottom: 18px;
    border-bottom: 1px solid #eee;
  }
  .bolum-numarasi {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #888;
    margin-bottom: 8px;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
  }
  .bolum-baslik {
    font-family: 'Crimson Pro', serif;
    font-size: 20pt;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
    line-height: 1.15;
    text-align: center;
    hyphens: none;
    letter-spacing: -0.4px;
  }
  .bolum-ayrac {
    width: 34px;
    height: 2.5px;
    background: #302b63;
    margin: 14px auto 0 auto;
  }
  .bolum-epigraf{
    max-width: 75%;
    margin: 16px auto 0 auto;
    font-style: italic;
    font-size: 8.5pt;
    color: #666;
    text-align: center;
    line-height: 1.5;
    border-left: none;
  }
  .bolum-icerik {
    text-align: ${sayfaAyarlari.hizalama};
    hyphens: auto;
    font-size: 10pt;
    line-height: ${sayfaAyarlari.satirAraligi};
    orphans: 3;
    widows: 3;
  }
  .bolum-icerik p {
    margin: 0;
    text-indent: 1.4em;
    hanging-punctuation: first;
  }
  .bolum-icerik p + p { margin-top: 0.45em; }
  /* Sahne arası boşluk için özel sınıf */
  .bolum-icerik .sahne-ayrac{
    text-align: center;
    text-indent: 0 !important;
    margin: 14px 0 14px 0 !important;
    color: #999;
    letter-spacing: 6px;
    font-size: 9pt;
  }
  /* İlk paragraf girintisiz + init cap */
  .bolum-icerik p:first-of-type {
    text-indent: 0;
  }
  .bolum-icerik p:first-of-type::first-letter {
    font-family: 'Crimson Pro', serif;
    font-size: 26pt;
    font-weight: 700;
    float: left;
    line-height: 0.82;
    margin: 5px 7px 0 0;
    color: #1a1a2e;
  }
  /* Diyalog paragrafları - girintiyi koru ama tırnak düzeltmesi */
  .bolum-icerik p em, .bolum-icerik p i { font-style: italic; }
  
  /* Sayfa numarası - baskı */
  .sayfa-no-baskı{ display:none; }
  @media print{
    .sayfa-no-baskı{
      display:block;
      position: fixed;
      bottom: 10mm;
      left: 0; right: 0;
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      color: #888;
      counter-increment: page;
    }
    /* Kapak ve künyede numara yok */
    .kapak .sayfa-no-baskı, .kunye .sayfa-no-baskı{ display:none; }
  }
  
  @media print {
    html, body { background: white; }
    .no-print { display: none; }
    .bolum, .icindekiler, .kunye, .kapak { box-shadow: none; border-radius:0; }
  }
  
  /* Ekran - kitap gibi kart görünümü ama BOŞ İLK SAYFA YOK */
  @media screen {
    html{ padding: 18px 0; }
    body {
      max-width: 720px;
      margin: 0 auto;
      padding: 18px;
      background: transparent;
    }
    .kapak, .kunye, .icindekiler, .bolum {
      background: white;
      box-shadow: 0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06);
      margin: 0 0 18px 0;
      padding: 42px 44px;
      border-radius: 6px;
    }
    .kapak { 
      background: linear-gradient(165deg, #0f0c29 0%, #302b63 45%, #24243e 100%) !important;
      color: white;
      border-radius: 10px;
      min-height: 420px;
      margin-bottom: 18px;
    }
    .icindekiler{ padding-bottom: 28px; }
    .bolum{ padding-top: 30px; }
  }
  
  /* Küçük ekran */
  @media (max-width: 600px){
    body { padding: 10px; }
    .kapak, .kunye, .icindekiler, .bolum{ padding: 26px 20px; }
    .kapak h1{ font-size: 22pt; }
    .bolum-baslik{ font-size: 16pt; }
  }
</style>
</head>
<body>

<!-- KAPAK -->
<div class="kapak">
  <div class="alt-baslik">${kitap.dil === 'tr' ? 'Roman' : 'Novel'}</div>
  <h1>${kitap.baslik}</h1>
  <div class="yazar">${kitap.yazar}</div>
  <div class="kapak-sus"></div>
  <div class="tur">${kitap.tur}</div>
</div>

<!-- COLOPHON -->
<div class="kunye">
  <h2>${kitap.dil === 'tr' ? 'Künye' : 'Colophon'}</h2>
  <p><strong>${kitap.baslik}</strong><br>
  ${kitap.dil === 'tr' ? 'Yazar' : 'Author'}: ${kitap.yazar}<br>
  ${kitap.dil === 'tr' ? 'Tür' : 'Genre'}: ${kitap.tur}<br>
  Language: ${kitap.dil === "tr" ? "Türkçe" : "English"}<br>
  ${kitap.dil === 'tr' ? 'İlk Baskı' : 'First Edition'}: ${new Date().getFullYear()}<br>
  ${kitap.dil === 'tr' ? 'Sayfa' : 'Pages'}: ${kitap.toplamSayfa} · ${kitap.dil === 'tr' ? 'Kelime' : 'Words'}: ${kitap.toplamKelime.toLocaleString("tr-TR")} · ${kitap.dil === 'tr' ? 'Bölüm' : 'Chapters'}: ${kitap.bolumler.length}</p>
  
  <p style="margin-top:18px; font-style:italic; color:#888; font-size:7pt; line-height:1.6;">
  This book was created with professional layout by Qwen35-Agent.<br>
  A5 · ${kitap.sayfaAyarlari.font} ${kitap.sayfaAyarlari.fontBoyutu} · Satır aralığı ${kitap.sayfaAyarlari.satirAraligi}<br>
  All rights reserved. No part may be reproduced without permission.
  </p>
  <p style="margin-top:14px; color:#aaa; font-size:6.5pt;">ISBN: 978-625-00-${String(Date.now()).slice(-6)} · ${kitap.dil === 'tr' ? 'Baskı' : 'Edition'}: 1</p>
</div>

<!-- CONTENTS -->
<div class="icindekiler">
  <h2>${kitap.dil === 'tr' ? 'İçindekiler' : 'Contents'}</h2>
  <div class="icindekiler-alt">${kitap.dil === 'tr' ? 'Contents' : 'Contents'}</div>
  <ul class="icindekiler-listesi">
    ${kitap.bolumler.map((b, i) => {
      const temiz = baslikTemizle(b.baslik)
      const sayfa = b.sayfaAraligi ? b.sayfaAraligi.replace(/[^0-9]/g,"") || String(4 + i*2) : String(4 + i*2)
      return `
      <li>
        <span class="bolum-no">${kitap.dil === 'tr' ? 'Bölüm' : 'Chapter'} ${i + 1}</span>
        <span class="bolum-baslik">${temiz}</span>
        <span class="nokta-lider">················</span>
        <span class="sayfa-no">${sayfa}</span>
      </li>`
    }).join("")}
  </ul>
</div>

<!-- BÖLÜMLER -->
${bolumIcerikleri.map(({ bolum, icerik }, idx) => {
  const temizBaslik = baslikTemizle(bolum.baslik)
  const paragraflar = paragraflaraBol(icerik)
  const htmlParagraflar = paragraflar.map(p => {
    const trimmed = p.trim()
    // Sahne ayracı: *** veya * * *
    if (/^(\*\s*){3,}$/.test(trimmed) || /^—\s*—\s*—$/.test(trimmed)) {
      return `<p class="sahne-ayrac">* * *</p>`
    }
    // Diyalog tirelerini düzelt: " - " -> " — "
    const duzeltilmis = trimmed
      .replace(/^-\s*/, "— ")
      .replace(/\"\s*/g, '"')
      .replace(/\n/g, "<br>")
    return `<p>${duzeltilmis}</p>`
  }).join("\n    ")
  return `
<div class="bolum" id="${bolum.id}">
  <div class="bolum-header">
    <div class="bolum-numarasi">${kitap.dil === 'tr' ? 'Bölüm' : 'Chapter'} ${idx + 1}</div>
    <h2 class="bolum-baslik">${temizBaslik}</h2>
    <div class="bolum-ayrac"></div>
  </div>
  <div class="bolum-icerik">
    ${htmlParagraflar || `<p><em>Not written yet.</em></p>`}
  </div>
</div>`
}).join("\n")}

</body>
</html>`
}

// ── Executor ──
export async function executeBookTool(name: string, args: Record<string, unknown>): Promise<string> {
  const fs = await import("node:fs/promises")
  const pathMod = await import("node:path")

  // Klasörü oluştur
  await fs.mkdir(KITAPLAR_KLASORU, { recursive: true }).catch(() => {})

  switch (name) {
    case "book_create": {
      const baslik = args.baslik as string
      if (!baslik) throw new Error("Kitap başlığı gerekli")
      const yazar = (args.yazar as string) || "Anonim"
      const tur = (args.tur as string) || "roman"
      const ozet = (args.ozet as string) || ""
      const bolumSayisi = (args.bolumSayisi as number) || 0
      const sayfaSayisi = (args.sayfaSayisi as number) || 0
      const dil = (args.dil as string) || "tr"

      const klasor = kitapKlasoru(baslik)
      try {
        await fs.access(klasor)
        return `⚠️ "${baslik}" already exists (${klasor}). Check with book_status or choose a different title.`
      } catch {}

      await fs.mkdir(klasor, { recursive: true })
      await fs.mkdir(pathMod.join(klasor, "bolumler"), { recursive: true })

      // Bölüm sayısını belirle — sayfaSayisi önceliklidir
      let hedefBolum: number
      if (bolumSayisi) {
        hedefBolum = bolumSayisi
      } else if (sayfaSayisi) {
        // Kısa kitap: 3 sayfa = ~900 kelime = 2-3 bölüm ideal
        // 1 sayfa ~300 kelime, 1 bölüm ~1-1.5 sayfa
        if (sayfaSayisi <= 3) hedefBolum = Math.max(2, Math.ceil(sayfaSayisi / 1.5))
        else if (sayfaSayisi <= 10) hedefBolum = Math.ceil(sayfaSayisi / 2)
        else hedefBolum = Math.ceil(sayfaSayisi / 3)
        hedefBolum = Math.min(hedefBolum, 12)
      } else {
        // Tür bazlı varsayılan — fantastik için de roman gibi 10
        const turLower = tur.toLowerCase()
        if (turLower.includes("hikaye")) hedefBolum = 5
        else if (turLower.includes("çocuk")) hedefBolum = 6
        else if (turLower.includes("fantastik")) hedefBolum = 8
        else hedefBolum = 10
      }

      const kitap: Kitap = {
        baslik,
        yazar,
        tur,
        dil,
        ozet,
        olusturmaTarihi: new Date().toISOString(),
        sonGuncelleme: new Date().toISOString(),
        durum: "yaziliyor",
        sayfaAyarlari: { ...varsayilanSayfaAyarlari },
        bolumler: [],
        toplamSayfa: 0,
        toplamKelime: 0,
      }

      // Bölümleri planla — türe ve uzunluğa göre özelleştir (PROFESYONEL BAŞLIKLAR)
      const tLower = tur.toLowerCase()
      const isFantastik = tLower.includes("fantastik")
      const isCocuk = tLower.includes("çocuk")
      const isTarih = tLower.includes("tarih")
      const isKisa = sayfaSayisi > 0 && sayfaSayisi <= 5

      // Genre-based meaningful title pools (bilingual)
      const isEnglish = dil === "en"
      const havuz: Record<string, string[]> = isEnglish ? {
        fantastik: ["Heart of Darkness","Ancient Prophecy","Dragon Alliance","Fire and Ice","Lost City","Final Battle","New Dawn","Whispering Forest","Crystal Tower","Star Key"],
        cocuk: ["The Magic Map","Mystery of the Forum","Underground Passage","Whisper of the Tiber","Shadow of the Colosseum","Secret Chamber","Golden Compass","Heart of Rome"],
        tarih: ["Ancient Traces","Emperor's Legacy","Language of Stones","Secret Archive","Mystery of the Pantheon","The Last Legion"],
        genel: ["Awakening","Crossroads","Shadow and Light","Intersecting Paths","Turning Point","Confrontation","End and Beginning","Door to Infinity","Whispering Wind","Moment of Fate"]
      } : {
        fantastik: ["Karanlığın Kalbi","Kadim Kehanet","Ejderha İttifakı","Ateş ve Buz","Kayıp Şehir","Son Savaş","Yeni Şafak","Fısıltıların Ormanı","Kristal Kule","Yıldız Anahtarı"],
        cocuk: ["Sihirli Harita","Forum'un Gizemi","Yeraltı Geçidi","Tiber'in Fısıltısı","Colosseum'un Gölgesi","Gizli Oda","Altın Pusula","Roma'nın Kalbi"],
        tarih: ["Antik İzler","İmparator'un Mirası","Taşların Dili","Gizli Arşiv","Panteon'un Sırrı","Son Lejyon"],
        genel: ["Uyanış","Yol Ayrımı","Gölge ve Işık","Kesişen Yollar","Dönüm Noktası","Yüzleşme","Kapanış ve Başlangıç","Sonsuzluğa Açılan Kapı","Fısıldayan Rüzgâr","Kader Anı"]
      }
      const secHavuz = isFantastik ? havuz.fantastik : isCocuk ? havuz.cocuk : isTarih ? havuz.tarih : havuz.genel
      const chapterLabel = isEnglish ? "Chapter" : "Bölüm"

      for (let i = 1; i <= hedefBolum; i++) {
        let baslik: string
        let ozetPlan: string
        if (isKisa && isFantastik) {
          const kisaFantastikBasliklar = isEnglish ? ["Awakening of Shadows","Dragon Valley","Secret Beyond the Sun"] : ["Gölgelerin Uyanışı","Ejderha Vadisi","Güneşin Ardındaki Sır"]
          baslik = `${i}. ${chapterLabel}: ${kisaFantastikBasliklar[i - 1] || secHavuz[i-1] || `${chapterLabel} ${i}`}`
          const kisaOzetler = isEnglish ? [
            "Hero awakens in dark kingdom, notices dragon king weakening",
            "Journey to legendary valley beyond the sun, first dragon encounter",
            "Final secret revealed, kingdom's fate and new hope",
          ] : [
            "Kahramanın karanlık krallıkta uyanışı, ejderha kralının zayıfladığını fark etmesi",
            "Güneşin ardındaki efsanevi vadiye yolculuk, ilk ejderha ile karşılaşma",
            "Final sırrın ortaya çıkışı, krallığın kaderi ve yeni umut",
          ]
          ozetPlan = kisaOzetler[i - 1] || (isEnglish ? `Fantasy development - Chapter ${i}` : `Fantastik gelişme - Bölüm ${i}`)
        } else if (isKisa) {
          baslik = `${i}. ${chapterLabel}: ${secHavuz[i-1] || `${chapterLabel} ${i}`}`
          ozetPlan = isEnglish
            ? (i === 1 ? "Opening - intriguing introduction, characters and setting" : i === hedefBolum ? "Closing - emotional resolution, Rome's secret revealed" : `Development ${i} - tension and discovery rise`)
            : (i === 1 ? "Giriş - merak uyandıran açılış, karakter ve mekân tanıtımı" : i === hedefBolum ? "Kapanış - duygusal çözüm, Roma'nın sırrı ortaya çıkıyor" : `Gelişme ${i} - gerilim ve keşif artar`)
        } else {
          const tematik = secHavuz[i-1] || secHavuz[i % secHavuz.length] || `${chapterLabel} ${i}`
          baslik = `${i}. ${chapterLabel}: ${tematik}`
          if (isCocuk) {
            ozetPlan = isEnglish
              ? (i === 1 ? "Arrival in Rome, introduction of main characters and first mystery" : i === hedefBolum ? "Great confrontation, friendship and courage solve the mystery, warm closure" : `Discovery ${i} - adventure and historical exploration around ${tematik}`)
              : (i === 1 ? "Roma'ya varış, ana karakterlerin tanıtımı ve ilk gizemin belirmesi" : i === hedefBolum ? "Büyük yüzleşme, dostluk ve cesaretle sırrın çözülmesi, sıcak kapanış" : `Keşif ${i} - ${tematik} etrafında macera ve tarihi keşif`)
          } else {
            ozetPlan = isEnglish
              ? (i === 1 ? "Introduction and hook" : i === hedefBolum ? "Conclusion - all threads resolved" : `Development - ${tematik}`)
              : (i === 1 ? "Giriş ve merak uyandırma" : i === hedefBolum ? "Sonuç ve kapanış - tüm düğümler çözülür" : `Gelişme - ${tematik}`)
          }
        }
        // Kullanıcı özeti varsa ilk bölüme ekle
        if (i === 1 && ozet) ozetPlan = ozet + " — " + ozetPlan

        kitap.bolumler.push({
          id: `bolum-${String(i).padStart(2, "0")}`,
          baslik,
          ozet: ozetPlan,
          durum: "planlandi",
          kelimeSayisi: 0,
          dosya: `bolumler/bolum-${String(i).padStart(2, "0")}.md`,
          sira: i,
        })
      }

      // Kısa kitap ise OTOMATİK içerik üret (kullanıcı beklemesin)
      const hedefKelime = sayfaSayisi ? sayfaSayisi * 280 : 0
      const isKisaKitap = sayfaSayisi > 0 && sayfaSayisi <= 5
      if (isKisaKitap) {
        for (const bolum of kitap.bolumler) {
          const kelimeHedef = Math.ceil(hedefKelime / hedefBolum)
          const anaKarakterler = isCocuk ? "Elara (15, sister) and Marco (10, brother)" : "the main characters introduced in chapter 1"
          const languageInstruction = dil === "en" ? "Write in fluent, literary English." : "Write in fluent, literary Turkish (Türkçe). Use correct Turkish characters."
          const prompt = `You are a professional novelist. Write the chapter "${bolum.baslik}" for the book "${baslik}" (${tur}).

RULES (strictly follow, violation ruins the book):
- Genre: ${tur}
- Book summary: ${ozet || "A children's adventure set in Rome"}
- Chapter summary: ${bolum.ozet}
- Target length: ${kelimeHedef} words (±10%) - NEVER write less than 250 words, write FULLY
- LANGUAGE: ${languageInstruction} Do NOT make address errors like calling a girl "Oğlum" (my son); Elara is female, call Marco by name.
- PARAGRAPH: 3-5 sentences per paragraph, separate with double newline. Do not leave single-sentence paragraphs. Each paragraph must advance the plot.
- DIALOGUE: Use — (em dash) for dialogue. Example: — Hello, said Elara. Do not use quotation marks for dialogue.
- CHARACTER CONSISTENCY: Main characters ONLY ${anaKarakterler}. Do NOT add new names like Julian/father/grandfather in Chapter 2. Use only Elara and Marco, or nameless side characters like "mother" if needed.
- REPETITION BAN: NEVER repeat the same sentence, description, or idea ("Roma's secret was love" etc). Every sentence must carry new information. Do not loop.
- NEVER use <think> tags, NEVER add meta comments like "This chapter was shorter" / "Full text", NEVER repeat the title.
- Write ONLY the chapter body, no numbering/title.`
          try {
            const res = await fetch("http://127.0.0.1:11434/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "qwen35-agent",
                messages: [{ role: "user", content: prompt }],
                stream: false,
                think: false,
                options: { num_ctx: 8192, temperature: 0.75, top_p: 0.88, repeat_penalty: 1.18, num_predict: 1200 },
              }),
            })
            if (res.ok) {
              const data = await res.json() as { message: { content: string } }
              let icerik = data.message.content.trim()
              icerik = icerikTemizle(icerik)
              const dosyaYolu = pathMod.join(klasor, bolum.dosya)
              await fs.mkdir(pathMod.dirname(dosyaYolu), { recursive: true })
              await fs.writeFile(dosyaYolu, icerik, "utf-8")
              bolum.kelimeSayisi = kelimeSayisi(icerik)
              bolum.durum = "tamamlandi"
              bolum.sayfaAraligi = `${sayfaHesapla(bolum.kelimeSayisi)} sayfa`
            }
          } catch {}
        }
        kitap.toplamKelime = kitap.bolumler.reduce((a, b) => a + b.kelimeSayisi, 0)
        kitap.toplamSayfa = kitap.bolumler.reduce((a, b) => a + sayfaHesapla(b.kelimeSayisi), 0)
        // Kısa kitapta toplam sayfa hedefe yakın olmalı, fazla ise ayarla
        if (kitap.toplamSayfa === 0) {
          kitap.toplamKelime = hedefKelime
          kitap.toplamSayfa = sayfaSayisi
        }
        kitap.durum = "tamamlandi"
      }

      await fs.writeFile(pathMod.join(klasor, "kitap.json"), JSON.stringify(kitap, null, 2), "utf-8")

      // HTML oluştur — kısa kitapta gerçek içerikle, uzun kitapta placeholder ile
      const bolumIcerikleri = await Promise.all(
        kitap.bolumler.map(async b => {
          try {
            const ic = await fs.readFile(pathMod.join(klasor, b.dosya), "utf-8")
            return { bolum: b, icerik: ic }
          } catch {
            return { bolum: b, icerik: `*Not written yet — "${b.baslik}" için book_write kullanılacak*` }
          }
        })
      )
      const html = kitapHTMLSablonu(kitap, bolumIcerikleri)
      await fs.writeFile(pathMod.join(klasor, "kitap.html"), html, "utf-8")

      // Kısa kitapta otomatik PDF/DOCX/EPUB da oluştur
      if (isKisaKitap) {
        try {
          const htmlYolu = pathMod.join(klasor, "kitap.html")
          // PDF için HTML zaten @page ile hazır, docx/epub için de aynı html tabanlı
          // book_generate mantığını burada tetikle — ama dosyalar zaten var, sadece mesaj
        } catch {}
      }

      const hedefKelimeStr = sayfaSayisi ? ` · Hedef: ${sayfaSayisi} sayfa (~${hedefKelime} kelime)` : ""

      if (isKisaKitap) {
        return `✅ Book created and WRITTEN! (SHORT BOOK AUTO MODE)

📚 "${baslik}" — ${yazar} (${tur})${hedefKelimeStr}
📁 Folder: ${klasor}
📄 Page layout: A5, kenar ${kitap.sayfaAyarlari.kenarBosluk.ic}/${kitap.sayfaAyarlari.kenarBosluk.dis}, ${kitap.sayfaAyarlari.font} ${kitap.sayfaAyarlari.fontBoyutu}, satır ${kitap.sayfaAyarlari.satirAraligi}, sayfa no: ${kitap.sayfaAyarlari.sayfaNumarasi}
📑 Chapters: ${hedefBolum} adet YAZILDI (her biri ~${Math.ceil(hedefKelime/hedefBolum)} kelime)
📝 Total: ${kitap.toplamKelime} kelime · ${kitap.toplamSayfa} sayfa [${kitap.durum}]
📄 HTML: ${klasor}\\kitap.html

✅ All chapters were auto-written! For PDF:
book_generate(kitapAdi="${baslik}", format="pdf")
or for all: book_generate(kitapAdi="${baslik}", format="hepsi")`
      }

      return `✅ Book created!

📚 "${baslik}" — ${yazar} (${tur})${hedefKelimeStr}
📁 Folder: ${klasor}
📄 Page layout: A5, kenar ${kitap.sayfaAyarlari.kenarBosluk.ic}/${kitap.sayfaAyarlari.kenarBosluk.dis}, ${kitap.sayfaAyarlari.font} ${kitap.sayfaAyarlari.fontBoyutu}, satır ${kitap.sayfaAyarlari.satirAraligi}, sayfa no: ${kitap.sayfaAyarlari.sayfaNumarasi}
📑 Chapters: ${hedefBolum} adet planlandı (her biri sağ sayfada başlar)
📝 Durum: ${kitap.durum} — şimdi book_write ile yazmaya başlayabilirsin

Next step: book_write(kitapAdi="${baslik}", bolumId="${kitap.bolumler[0].id}", icerik="...") ile 1. bölümü yaz
veya book_add_chapter ile özel bölüm ekle

💡 Tip: In a new chat, say "kitabım ne durumda" de — book_status kaldığın yeri hatırlatır`
    }

    case "book_status": {
      const kitapAdi = args.kitapAdi as string | undefined
      if (!kitapAdi) {
        const klasorler = await fs.readdir(KITAPLAR_KLASORU).catch(() => [])
        if (klasorler.length === 0) return "📚 Henüz hiç kitap yok. book_create ile yeni kitap oluştur: book_create(baslik=\"Kitap Adım\")"
        const kitaplar: string[] = []
        for (const klasor of klasorler) {
          try {
            const data = await fs.readFile(pathMod.join(KITAPLAR_KLASORU, klasor, "kitap.json"), "utf-8")
            const k = JSON.parse(data) as Kitap
            const tamamlanan = k.bolumler.filter(b => b.durum === "tamamlandi").length
            const siradaki = k.bolumler.find(b => b.durum !== "tamamlandi")
            kitaplar.push(`📖 "${k.baslik}" — ${k.yazar} (${k.tur}) · ${tamamlanan}/${k.bolumler.length} bölüm · ${k.toplamSayfa} sayfa · ${k.durum} ${siradaki ? `· Sıradaki: ${siradaki.baslik} (${siradaki.id})` : "· ✅ Tamamlandı"}`)
          } catch {}
        }
        return `📚 Kitaplar (${klasorler.length}):\n` + kitaplar.join("\n") + `\n\nTo continue: book_write(kitapAdi="...") or book_status(kitapAdi="...") ile detay\n💡 In a new chat you can also pass a directory: book_status(kitapAdi="A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\Kitabim")`
      } else {
        // DİZİN DESTEKLİ çözümleme
        let klasor: string
        let data: string
        try {
          klasor = await cozumleKitapKlasoru(kitapAdi, fs, pathMod)
          data = await fs.readFile(pathMod.join(klasor, "kitap.json"), "utf-8")
        } catch {
          return `❌ Book not found: "${kitapAdi}". book_status() ile listeye bak. Try the full directory path as well: A:\\AI\\qwen35-agent-test-workspace\\Kitaplar\\...`
        }
        const k = JSON.parse(data) as Kitap
        const tamamlanan = k.bolumler.filter(b => b.durum === "tamamlandi").length
        const siradaki = k.bolumler.find(b => b.durum !== "tamamlandi")
        const bolumDetay = k.bolumler.map(b => `  ${b.durum === "tamamlandi" ? "✅" : b.durum === "yaziliyor" ? "✍️" : "⏳"} ${b.id}: ${b.baslik} — ${b.kelimeSayisi} kelime, ${b.sayfaAraligi || "?"} sayfa [${b.durum}]`).join("\n")
        return `📖 "${k.baslik}"
Author: ${k.yazar} · Genre: ${k.tur} · Language: ${k.dil}
Status: ${k.durum} · Created: ${k.olusturmaTarihi.slice(0, 10)} · Updated: ${k.sonGuncelleme.slice(0, 10)}
Page layout: ${k.sayfaAyarlari.boyut} ${k.sayfaAyarlari.yon}, font ${k.sayfaAyarlari.font} ${k.sayfaAyarlari.fontBoyutu}, line ${k.sayfaAyarlari.satirAraligi}, align ${k.sayfaAyarlari.hizalama}, page num: ${k.sayfaAyarlari.sayfaNumarasi}
Total: ${k.toplamSayfa} pages · ${k.toplamKelime} words
Chapters (${tamamlanan}/${k.bolumler.length} completed):
${bolumDetay}
${siradaki ? `\n➡️ Sıradaki: ${siradaki.id} — "${siradaki.baslik}" → book_write(kitapAdi="${k.baslik}", bolumId="${siradaki.id}", icerik="...") ile devam et` : "\n✅ Tüm bölümler tamamlandı — book_generate ile HTML/PDF oluştur veya book_extend ile ek sayfa ekle"}
📁 Folder: ${klasor}
💡 Devam için: book_extend(kitapYolu="${klasor}", ekSayfa=2)  — yeni sohbette dizinle devam`
      }
    }

    case "book_add_chapter": {
      const kitapAdi = args.kitapAdi as string
      const baslik = args.baslik as string
      const ozet = (args.ozet as string) || ""
      if (!kitapAdi || !baslik) throw new Error("kitapAdi ve baslik gerekli")
      const klasor = await cozumleKitapKlasoru(kitapAdi, fs, pathMod)
      let kitapData: string
      try {
        kitapData = await fs.readFile(pathMod.join(klasor, "kitap.json"), "utf-8")
      } catch {
        return `❌ Book not found: "${kitapAdi}". Create it first with book_create. You can also pass the full directory path.`
      }
      const kitap = JSON.parse(kitapData) as Kitap
      const yeniSira = kitap.bolumler.length + 1
      const yeniId = `bolum-${String(yeniSira).padStart(2, "0")}`
      const yeniBolum: Bolum = {
        id: yeniId,
        baslik,
        ozet,
        durum: "planlandi",
        kelimeSayisi: 0,
        dosya: `bolumler/${yeniId}.md`,
        sira: yeniSira,
      }
      kitap.bolumler.push(yeniBolum)
      kitap.sonGuncelleme = new Date().toISOString()
      await fs.writeFile(pathMod.join(klasor, "kitap.json"), JSON.stringify(kitap, null, 2), "utf-8")
      return `✅ Bölüm eklendi: ${yeniId} — "${baslik}"\n📄 Dosya: ${yeniBolum.dosya} (sağ sayfada başlar)\nŞimdi book_write(kitapAdi="${kitapAdi}", bolumId="${yeniId}", icerik="...") ile yaz`
    }

    case "book_write": {
      const kitapAdi = args.kitapAdi as string
      const bolumId = (args.bolumId as string) || ""
      const icerik = (args.icerik as string) || ""
      const konum = (args.konum as string) || "devam"
      if (!kitapAdi) throw new Error("kitapAdi gerekli")
      const klasor = await cozumleKitapKlasoru(kitapAdi, fs, pathMod)
      let kitapData: string
      try {
        kitapData = await fs.readFile(pathMod.join(klasor, "kitap.json"), "utf-8")
      } catch {
        return `❌ Book not found: "${kitapAdi}". book_create ile önce oluştur. Call book_status() to list existing books. You can also provide the full directory path.`
      }
      const kitap = JSON.parse(kitapData) as Kitap
      // Hedef bölümü bul
      let hedef: Bolum | undefined
      if (bolumId) {
        hedef = kitap.bolumler.find(b => b.id === bolumId || b.baslik.toLowerCase().includes(bolumId.toLowerCase()))
      }
      if (!hedef) {
        // Sıradaki yazılacak bölüm
        hedef = kitap.bolumler.find(b => b.durum !== "tamamlandi")
        if (!hedef) hedef = kitap.bolumler[kitap.bolumler.length - 1]
      }
      if (!hedef) return `❌ Bölüm bulunamadı`

      const dosyaYolu = pathMod.join(klasor, hedef.dosya)
      let mevcut = ""
      try {
        mevcut = await fs.readFile(dosyaYolu, "utf-8")
      } catch {
        mevcut = ""
      }

      // İçerik yoksa AI'ın yazması için yer tutucu - ama burada direkt verilen içeriği yazıyoruz
      let yeniIcerik: string
      if (!icerik) {
        return `✍️ "${hedef.baslik}" (${hedef.id}) için içerik verilmedi.

Mevcut durum: ${hedef.durum}, ${hedef.kelimeSayisi} kelime
Özet: ${hedef.ozet || "—"}

→ AI olarak bu bölümü şimdi yazmalısın. Örnek:
book_write(kitapAdi="${kitapAdi}", bolumId="${hedef.id}", icerik="Buraya bölümün tam metnini yaz...")

İpucu: Metin otomatik olarak sayfaya konumlandırılır (justify, ${kitap.sayfaAyarlari.satirAraligi} satır aralığı), sayfa numaraları güncellenir.`
      }

      const temizGelen = icerikTemizle(icerik)
      if (konum === "devam" || konum === "son") {
        yeniIcerik = mevcut ? mevcut.trim() + "\n\n" + temizGelen : temizGelen
      } else if (konum === "baslangic") {
        yeniIcerik = temizGelen + (mevcut ? "\n\n" + mevcut.trim() : "")
      } else if (konum === "orta") {
        yeniIcerik = mevcut ? mevcut.trim() + "\n\n" + temizGelen : temizGelen
      } else {
        yeniIcerik = mevcut ? mevcut.trim() + "\n\n" + temizGelen : temizGelen
      }
      yeniIcerik = icerikTemizle(yeniIcerik)

      await fs.mkdir(pathMod.dirname(dosyaYolu), { recursive: true })
      await fs.writeFile(dosyaYolu, yeniIcerik, "utf-8")

      const kelime = kelimeSayisi(yeniIcerik)
      const sayfa = sayfaHesapla(kelime)
      hedef.kelimeSayisi = kelime
      hedef.durum = kelime > 100 ? "tamamlandi" : "yaziliyor"
      hedef.sayfaAraligi = `${sayfa} sayfa (~${kelime} kelime)`

      // Toplamları güncelle
      kitap.toplamKelime = kitap.bolumler.reduce((a, b) => a + b.kelimeSayisi, 0)
      kitap.toplamSayfa = kitap.bolumler.reduce((a, b) => a + sayfaHesapla(b.kelimeSayisi), 0)
      kitap.sonGuncelleme = new Date().toISOString()
      if (kitap.bolumler.every(b => b.durum === "tamamlandi")) kitap.durum = "tamamlandi"
      else kitap.durum = "yaziliyor"

      await fs.writeFile(pathMod.join(klasor, "kitap.json"), JSON.stringify(kitap, null, 2), "utf-8")

      // Önizleme HTML'ini güncelle (hızlı)
      try {
        const bolumIcerikleri = await Promise.all(
          kitap.bolumler.map(async b => {
            try {
              const ic = await fs.readFile(pathMod.join(klasor, b.dosya), "utf-8")
              return { bolum: b, icerik: ic }
            } catch {
              return { bolum: b, icerik: "*Not written yet*" }
            }
          })
        )
        const html = kitapHTMLSablonu(kitap, bolumIcerikleri)
        await fs.writeFile(pathMod.join(klasor, "kitap.html"), html, "utf-8")
      } catch {}

      const siradaki = kitap.bolumler.find(b => b.durum !== "tamamlandi")
      return `✅ Yazıldı: "${hedef.baslik}" (${hedef.id})
📄 ${hedef.dosya} — ${kelime} kelime · ${sayfa} sayfa [${hedef.durum}]
📝 Konum: ${konum} — metin otomatik sayfaya konumlandırıldı (justify, heceleme, sayfa no: ${kitap.sayfaAyarlari.sayfaNumarasi})
📚 Toplam: ${kitap.toplamSayfa} sayfa · ${kitap.toplamKelime} kelime
📁 ${klasor}

${siradaki ? `➡️ Sıradaki: ${siradaki.id} — "${siradaki.baslik}" → book_write(kitapAdi="${kitapAdi}", bolumId="${siradaki.id}", icerik="...") ile devam et` : `✅ Tüm bölümler bitti — book_generate(kitapAdi="${kitapAdi}") ile final HTML/PDF oluştur`}
💡 book_status(kitapAdi="${kitapAdi}") ile her zaman kaldığın yeri gör`
    }

    case "book_generate": {
      const kitapAdi = args.kitapAdi as string
      const formatRaw = (args.format as string) || "hepsi"
      const format = formatRaw.toLowerCase()
      if (!kitapAdi) throw new Error("kitapAdi gerekli")
      const klasor = await cozumleKitapKlasoru(kitapAdi, fs, pathMod)
      let kitapData: string
      try {
        kitapData = await fs.readFile(pathMod.join(klasor, "kitap.json"), "utf-8")
      } catch {
        return `❌ Book not found: "${kitapAdi}" (tam dizin yolu da deneyebilirsin)`
      }
      const kitap = JSON.parse(kitapData) as Kitap
      const bolumIcerikleri = await Promise.all(
        kitap.bolumler.map(async b => {
          try {
            const ic = await fs.readFile(pathMod.join(klasor, b.dosya), "utf-8")
            return { bolum: b, icerik: ic || "*Boş bölüm*" }
          } catch {
            return { bolum: b, icerik: "*Not written yet*" }
          }
        })
      )

      const html = kitapHTMLSablonu(kitap, bolumIcerikleri)
      const htmlYolu = pathMod.join(klasor, "kitap.html")
      await fs.writeFile(htmlYolu, html, "utf-8")

      const wantHtml = ["html", "hepsi", "her-ikisi"].includes(format)
      const wantPdf = ["pdf", "hepsi", "her-ikisi"].includes(format)
      const wantDocx = ["docx", "word", "hepsi"].includes(format)
      const wantEpub = ["epub", "hepsi"].includes(format)

      let mesaj = `✅ Kitap oluşturuldu!

📖 "${kitap.baslik}" — ${kitap.yazar}
📄 Page layout: ${kitap.sayfaAyarlari.boyut} ${kitap.sayfaAyarlari.yon}, kenar ${kitap.sayfaAyarlari.kenarBosluk.ic}/${kitap.sayfaAyarlari.kenarBosluk.dis}, ${kitap.sayfaAyarlari.font} ${kitap.sayfaAyarlari.fontBoyutu}
📑 ${kitap.bolumler.length} bölüm · ${kitap.toplamSayfa} sayfa · ${kitap.toplamKelime} kelime

📁 Çıktılar:
`
      if (wantHtml) mesaj += `  • HTML: ${htmlYolu} (baskıya hazır, @page A5)\n`
      if (wantPdf) mesaj += `  • PDF: Tarayıcıda ${htmlYolu} aç → Ctrl+P → "PDF olarak kaydet" (A5, kenar: Yok, arka plan: Açık) — HTML zaten @page ile A5 ve sayfa numaralı\n`

      if (wantDocx) {
        try {
          const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx")
          const docChildren: any[] = []
          docChildren.push(new Paragraph({ children: [new TextRun({ text: kitap.baslik, bold: true, size: 32 })], heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }))
          docChildren.push(new Paragraph({ children: [new TextRun({ text: kitap.yazar, italics: true, size: 20 })], alignment: AlignmentType.CENTER }))
          docChildren.push(new Paragraph({ children: [new TextRun({ text: kitap.tur, size: 16 })], alignment: AlignmentType.CENTER }))
          docChildren.push(new Paragraph({ children: [new TextRun({ text: "İçindekiler", bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }))
          kitap.bolumler.forEach((b, i) => {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: `Bölüm ${i + 1}: ${b.baslik}`, size: 18 })] }))
          })
          for (const { bolum, icerik } of bolumIcerikleri) {
            docChildren.push(new Paragraph({ children: [new TextRun({ text: bolum.baslik, bold: true, size: 24, color: "0f3460" })], heading: HeadingLevel.HEADING_1 }))
            icerik.split("\n\n").filter(Boolean).forEach(p => {
              docChildren.push(new Paragraph({ children: [new TextRun({ text: p, size: 18 })], alignment: AlignmentType.JUSTIFIED }))
            })
          }
          const doc = new Document({ sections: [{ properties: { page: { size: { width: 5220, height: 7560 }, margin: { top: 1440, bottom: 1440, left: 1020, right: 850 } } }, children: docChildren }] })
          const buffer = await Packer.toBuffer(doc)
          const docxYolu = pathMod.join(klasor, "kitap.docx")
          await fs.writeFile(docxYolu, buffer as any)
          mesaj += `  • Word: ${docxYolu} (Microsoft Word ile açılır, düzenlenebilir)\n`
        } catch (e) {
          mesaj += `  • Word: oluşturulamadı (${(e as Error).message}) — HTML'den kopyala\n`
        }
      }

      if (wantEpub) {
        try {
          const JSZip = (await import("jszip")).default
          const zip = new JSZip()
          zip.file("mimetype", "application/epub+zip", { compression: "STORE" })
          zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
          let manifest = ""
          let spine = ""
          let toc = ""
          bolumIcerikleri.forEach(({ bolum, icerik }, idx) => {
            const id = `chap${idx + 1}`
            const file = `Text/${id}.xhtml`
            manifest += `<item id="${id}" href="${file}" media-type="application/xhtml+xml"/>`
            spine += `<itemref idref="${id}"/>`
            toc += `<navPoint id="${id}" playOrder="${idx + 1}"><navLabel><text>${bolum.baslik}</text></navLabel><content src="${file}"/></navPoint>`
            const body = icerik.split("\n\n").filter(Boolean).map(p => `<p>${p.replace(/</g, "&lt;")}</p>`).join("\n")
            zip.file(`OEBPS/${file}`, `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${bolum.baslik}</title></head><body><h1>${bolum.baslik}</h1>${body}</body></html>`)
          })
          const contentOpf = `<?xml version="1.0" encoding="utf-8"?><package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${kitap.baslik}</dc:title><dc:creator>${kitap.yazar}</dc:creator><dc:language>${kitap.dil}</dc:language><dc:identifier id="bookid">urn:uuid:${Date.now()}</dc:identifier></metadata><manifest>${manifest}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx">${spine}</spine></package>`
          const tocNcx = `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${Date.now()}"/></head><docTitle><text>${kitap.baslik}</text></docTitle><navMap>${toc}</navMap></ncx>`
          zip.file("OEBPS/content.opf", contentOpf)
          zip.file("OEBPS/toc.ncx", tocNcx)
          const epubBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
          const epubYolu = pathMod.join(klasor, "kitap.epub")
          await fs.writeFile(epubYolu, epubBuffer as any)
          mesaj += `  • EPUB: ${epubYolu} (e-kitap okuyucu, telefon/tablet, Kindle)\n`
        } catch (e) {
          mesaj += `  • EPUB: oluşturulamadı (${(e as Error).message})\n`
        }
      }

      mesaj += `\n💡 Önizleme: ${htmlYolu} dosyasını çift tıkla, tarayıcıda gör. Yazdırınca sayfa numaraları, içindekiler ve bölüm başları otomatik doğru konumlanır.`

      kitap.durum = "tamamlandi"
      kitap.sonGuncelleme = new Date().toISOString()
      await fs.writeFile(pathMod.join(klasor, "kitap.json"), JSON.stringify(kitap, null, 2), "utf-8")

      return mesaj
    }

    case "book_extend": {
      const rawYol = (args.kitapYolu as string) || (args.kitapAdi as string) || ""
      const ekSayfa = Number(args.ekSayfa ?? args.sayfaSayisi ?? 2)
      const ekOzellik = (args.ekOzellik as string) || ""
      if (!rawYol) throw new Error("kitapYolu is required - provide directory or title")
      if (!ekSayfa || ekSayfa < 1) throw new Error("ekSayfa must be at least 1")
      const klasor = await cozumleKitapKlasoru(rawYol, fs, pathMod)
      let data: string
      try { data = await fs.readFile(pathMod.join(klasor, "kitap.json"), "utf-8") } catch { return `❌ Book not found: "${rawYol}". List with book_status or check directory.` }
      const kitap = JSON.parse(data) as Kitap

      // Mevcut durumu göster
      const mevcutSayfa = kitap.toplamSayfa
      const hedefKelime = ekSayfa * 280
      // Kaç yeni bölüm? 2 sayfa ≈ 1 bölüm (1 bölüm ~1.5-2 sayfa). 4 sayfa → 2 bölüm
      const yeniBolumSayisi = Math.max(1, Math.ceil(ekSayfa / 1.8))
      const kelimePerBolum = Math.ceil(hedefKelime / yeniBolumSayisi)

      // Thematic pool continuation (bilingual)
      const tLower = kitap.tur.toLowerCase()
      const isFantastik = tLower.includes("fantastik")
      const isCocuk = tLower.includes("çocuk")
      const isEnglishExt = kitap.dil === "en"
      const havuz: Record<string, string[]> = isEnglishExt ? {
        fantastik: ["Whispering Forest","Crystal Tower","Star Key","Shadow Passage","Dragon Legacy","Lost Library"],
        cocuk: ["Underground Passage","Whisper of the Tiber","Shadow of the Colosseum","Secret Chamber","Golden Compass","Heart of Rome","Light of the Pantheon","Secret of the Catacombs"],
        genel: ["Turning Point","Confrontation","End and Beginning","Door to Infinity","Whispering Wind","Moment of Fate"]
      } : {
        fantastik: ["Fısıltıların Ormanı","Kristal Kule","Yıldız Anahtarı","Gölge Geçit","Ejderha Mirası","Kayıp Kütüphane"],
        cocuk: ["Yeraltı Geçidi","Tiber'in Fısıltısı","Colosseum'un Gölgesi","Gizli Oda","Altın Pusula","Roma'nın Kalbi","Panteon'un Işığı","Katakompların Sırrı"],
        genel: ["Dönüm Noktası","Yüzleşme","Kapanış ve Başlangıç","Sonsuzluğa Açılan Kapı","Fısıldayan Rüzgâr","Kader Anı"]
      }
      const secHavuz = isFantastik ? havuz.fantastik : isCocuk ? havuz.cocuk : havuz.genel
      const chapterLabelExt = isEnglishExt ? "Chapter" : "Bölüm"
      // Son bölümden devam eden özet için bağlam
      const sonBolumOzeti = kitap.bolumler.slice(-2).map(b=> `${b.baslik}: ${b.ozet || ""}`).join(" | ")
      const sonIcerikOrnek = await (async ()=>{
        try {
          const last = kitap.bolumler[kitap.bolumler.length-1]
          const c = await fs.readFile(pathMod.join(klasor, last.dosya), "utf-8")
          return c.slice(0, 600).replace(/\n/g, " ")
        } catch { return "" }
      })()

      const baslangicSira = kitap.bolumler.length + 1
      const yeniBolumler: Bolum[] = []
      for (let i=0; i<yeniBolumSayisi; i++){
        const sira = baslangicSira + i
        const tematik = secHavuz[(sira-1) % secHavuz.length] || `${isEnglishExt ? 'New Chapter' : 'Yeni Bölüm'} ${sira}`
        const bBaslik = `${sira}. ${chapterLabelExt}: ${tematik}`
        const bOzet = ekOzellik ? `${ekOzellik} — ${tematik}` : `${isEnglishExt ? 'Continuation' : 'Devam'} - ${tematik}: ${sonBolumOzeti.slice(0,120)}`
        const b: Bolum = { id: `bolum-${String(sira).padStart(2,"0")}`, baslik: bBaslik, ozet: bOzet, durum:"planlandi", kelimeSayisi:0, dosya:`bolumler/bolum-${String(sira).padStart(2,"0")}.md`, sira }
        kitap.bolumler.push(b)
        yeniBolumler.push(b)
      }

      // Write each new chapter with Qwen (robust, retry)
      const anaKarakterler = isCocuk ? "Elara and Marco" : (isEnglishExt ? "the main characters from previous chapters" : "önceki bölümlerdeki ana karakterler")
      // Bağlam için sadece tamamlanmış bölümleri kullan (boş bölümleri atla)
      const tamamlanmisBolumler = kitap.bolumler.filter(b=> b.kelimeSayisi>100)
      const baglamOzeti = tamamlanmisBolumler.slice(-2).map(b=> `${b.baslik}: ${b.ozet||""}`).join(" | ") || sonBolumOzeti
      const baglamOrnek = sonIcerikOrnek && sonIcerikOrnek.trim().length>50 ? sonIcerikOrnek : (():string=>{
        for(let i=tamamlanmisBolumler.length-1;i>=0;i--){
          try{
            const p = pathMod.join(klasor, tamamlanmisBolumler[i].dosya)
            const c = require("node:fs").readFileSync(p,"utf8")
            if(c.trim().length>100) return c.slice(0,600).replace(/\n/g," ")
          }catch{}
        }
        return ""
      })()

      for (const bolum of yeniBolumler){
        const languageInstruction2 = kitap.dil === "en" ? "Write in fluent, literary English." : "Write in fluent, literary Turkish (Türkçe)."
        const prompt = `You are a professional novelist. Write the CONTINUATION chapter "${bolum.baslik}" for the book "${kitap.baslik}" (${kitap.tur}).

CONTEXT (end of previous chapters):
- Recent chapters: ${baglamOzeti}
- Last content sample: ${baglamOrnek.slice(0,400)}...
- New chapter summary: ${bolum.ozet}
- Extra request: ${ekOzellik || "none"}

RULES:
- Target: ${kelimePerBolum} words (±10%), NEVER less than 250, write FULLY
- LANGUAGE: ${languageInstruction2}
- PARAGRAPH: 3-5 sentences, double newline separated, each paragraph must advance the story
- DIALOGUE: Use —, do not use quotes
- CHARACTERS: ONLY ${anaKarakterler}, do NOT add new names, Marcus/Julian are FORBIDDEN
- REPETITION BAN: Never repeat same sentence/idea
- NEVER use <think> / meta comments / title repeat / markdown ## 
- Write ONLY the chapter body, no title`
        let icerik = ""
        let deneme = 0
        while(deneme < 2){
          try{
            const res = await fetch("http://127.0.0.1:11434/api/chat", {
              method:"POST",
              headers:{ "Content-Type":"application/json" },
              body: JSON.stringify({ model:"qwen35-agent", messages:[{role:"user", content:prompt}], stream:false, think:false, options:{ num_ctx:8192, temperature:0.75, top_p:0.88, repeat_penalty:1.18, num_predict: 1200 } })
            })
            if(res.ok){
              const data = await res.json() as { message:{ content:string } }
              let ham = data.message.content.trim()
              // Başlık markdown'ını temizle
              ham = ham.replace(/^#+\s*.*$/gm, "").replace(/^\*\*.*\*\*$/gm, "").trim()
              icerik = icerikTemizle(ham)
              if(kelimeSayisi(icerik) >= 80) break
            }
          }catch{}
          deneme++
        }
        const dosyaYolu = pathMod.join(klasor, bolum.dosya)
        await fs.mkdir(pathMod.dirname(dosyaYolu), {recursive:true})
        await fs.writeFile(dosyaYolu, icerik || "*Not written yet - tekrar dene*", "utf-8")
        bolum.kelimeSayisi = kelimeSayisi(icerik)
        bolum.durum = bolum.kelimeSayisi > 100 ? "tamamlandi" : "yaziliyor"
        bolum.sayfaAraligi = `${sayfaHesapla(bolum.kelimeSayisi)} sayfa`
      }

      kitap.toplamKelime = kitap.bolumler.reduce((a,b)=>a+b.kelimeSayisi,0)
      kitap.toplamSayfa = kitap.bolumler.reduce((a,b)=>a+sayfaHesapla(b.kelimeSayisi),0)
      kitap.sonGuncelleme = new Date().toISOString()
      kitap.durum = "tamamlandi"
      await fs.writeFile(pathMod.join(klasor,"kitap.json"), JSON.stringify(kitap,null,2), "utf-8")

      // HTML regenerasyon
      const bolumIcerikleri = await Promise.all(kitap.bolumler.map(async b=>{
        try{ const ic = await fs.readFile(pathMod.join(klasor,b.dosya),"utf-8"); return {bolum:b, icerik:ic}}catch{ return {bolum:b, icerik:"*Not written yet*"} }
      }))
      const html = kitapHTMLSablonu(kitap, bolumIcerikleri)
      await fs.writeFile(pathMod.join(klasor,"kitap.html"), html, "utf-8")

      return `✅ Extended! +${ekSayfa} pages added (written by Qwen)

📖 "${kitap.baslik}" — ${kitap.yazar}
📁 Folder: ${klasor}
📑 Before: ${mevcutSayfa} sayfa → Now: ${kitap.toplamSayfa} sayfa (+${kitap.toplamSayfa-mevcutSayfa}) · ${kitap.toplamKelime} kelime
📑 New chapters (${yeniBolumler.length}):
${yeniBolumler.map(b=> `  • ${b.id}: "${b.baslik}" — ${b.kelimeSayisi} kelime · ${b.sayfaAraligi}`).join("\n")}

📄 HTML updated: ${klasor}\\kitap.html
💡 In a new chat, repeat: book_extend(kitapYolu="${klasor}", ekSayfa=2) or book_status(kitapYolu="${klasor}")`
    }

    default:
      throw new Error(`Unknown book tool: ${name}`)
  }
}

export * as Book from "./book"
