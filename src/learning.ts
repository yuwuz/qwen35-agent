/**
 * Qwen35-Agent Öğrenme Sistemi (Smith Self-Update)
 * - Hatadan öğrenir, bir sonraki hatayı otomatik düzeltir
 * - Başarılı pattern'i kaydeder, sistemde kalıcı yapar
 * - qwen-learning.json'a yazar
 */

import fs from "node:fs/promises"
import path from "node:path"

const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"
const LEARNING_FILE = path.join(DESKTOP, "qwen-learning.json")
const AGENT_DIR = path.join(DESKTOP, "qwen35-agent")

export interface LearningRule {
  id: string
  type: "error_fix" | "success_pattern" | "optimization"
  trigger: string // örn: "Cannot read property"
  fix: string // örn: "null check ekle"
  file?: string // hangi dosyaya uygulanmalı
  count: number
  lastUsed: number
}

export interface LearningFile {
  version: number
  rules: LearningRule[]
  stats: { totalLearnings: number; autoApplied: number }
}

const defaultLearning: LearningFile = { version: 1, rules: [], stats: { totalLearnings: 0, autoApplied: 0 } }

export async function loadLearning(): Promise<LearningFile> {
  try {
    const raw = await fs.readFile(LEARNING_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return { ...defaultLearning }
  }
}

export async function saveLearning(data: LearningFile): Promise<void> {
  await fs.writeFile(LEARNING_FILE, JSON.stringify(data, null, 2), "utf-8")
}

export async function learnFromError(error: string, fix: string, file?: string): Promise<void> {
  const data = await loadLearning()
  const key = error.slice(0, 80).toLowerCase()
  let rule = data.rules.find((r) => r.trigger.toLowerCase() === key)
  if (rule) {
    rule.count++
    rule.lastUsed = Date.now()
    rule.fix = fix
  } else {
    rule = {
      id: `rule_${Date.now()}`,
      type: "error_fix",
      trigger: error.slice(0, 120),
      fix: fix.slice(0, 300),
      file,
      count: 1,
      lastUsed: Date.now(),
    }
    data.rules.push(rule)
  }
  data.stats.totalLearnings++
  await saveLearning(data)
  console.log(`[learning] ${rule.trigger} -> ${rule.fix}`)
}

export async function learnFromSuccess(pattern: string, file?: string): Promise<void> {
  const data = await loadLearning()
  data.rules.push({
    id: `rule_${Date.now()}`,
    type: "success_pattern",
    trigger: pattern.slice(0, 120),
    fix: `Başarılı pattern: ${pattern.slice(0, 200)}`,
    file,
    count: 1,
    lastUsed: Date.now(),
  })
  data.stats.totalLearnings++
  await saveLearning(data)
}

export async function findFixForError(error: string): Promise<string | null> {
  const data = await loadLearning()
  const lower = error.toLowerCase()
  for (const r of data.rules) {
    if (r.type === "error_fix" && lower.includes(r.trigger.toLowerCase().slice(0, 30))) {
      return r.fix
    }
  }
  // Bilinen pattern'lar
  if (lower.includes("module not found") || lower.includes("cannot find module")) return "npm install veya import yolunu kontrol et"
  if (lower.includes("is not defined")) return "Değişkeni tanımla veya import et"
  if (lower.includes("cannot read")) return "Null check ekle: value?.prop veya if(value)"
  if (lower.includes("syntaxerror")) return "Syntax'i kontrol et, eksik parantez/virgül olabilir"
  if (lower.includes("enoent") || lower.includes("no such file")) return "Dosya yolunu kontrol et, Desktop fallback kullan"
  return null
}

export async function suggestFix(error: string): Promise<string> {
  const fix = await findFixForError(error)
  return fix ? `Öneri: ${fix}` : "Genel düzeltme: hatayı analiz et, ilgili dosyayı oku, sonra düzelt"
}
