/**
 * Qwen35-Agent Hafıza Sistemi (Smith Auto-Memory)
 * - Proje yapısını, son dosyaları, hataları ve istatistikleri hatırlar
 * - Otomatik kaydeder, bir sonraki görevde context olarak kullanır
 */

import fs from "node:fs/promises"
import path from "node:path"

const DESKTOP = "A:\\AI\\qwen35-agent-test-workspace"
const MEMORY_FILE = path.join(DESKTOP, "qwen-memory.json")

export interface MemoryFile {
  version: number
  updated: string
  project: {
    desktopFiles: string[]
    lastFiles: { path: string; time: number; size: number }[]
  }
  history: {
    totalTasks: number
    successRate: number
    lastErrors: { error: string; fix: string; time: number }[]
  }
  stats: {
    totalTokens: number
    avgDuration: number
  }
}

const defaultMemory: MemoryFile = {
  version: 1,
  updated: new Date().toISOString(),
  project: { desktopFiles: [], lastFiles: [] },
  history: { totalTasks: 0, successRate: 1, lastErrors: [] },
  stats: { totalTokens: 0, avgDuration: 0 },
}

export async function loadMemory(): Promise<MemoryFile> {
  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf-8")
    return JSON.parse(raw) as MemoryFile
  } catch {
    return { ...defaultMemory }
  }
}

export async function saveMemory(patch: Partial<MemoryFile>): Promise<void> {
  const current = await loadMemory()
  const next: MemoryFile = {
    ...current,
    ...patch,
    project: { ...current.project, ...(patch.project || {}) },
    history: { ...current.history, ...(patch.history || {}) },
    stats: { ...current.stats, ...(patch.stats || {}) },
    updated: new Date().toISOString(),
  }
  await fs.writeFile(MEMORY_FILE, JSON.stringify(next, null, 2), "utf-8")
}

export async function rememberFile(filePath: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath)
    const mem = await loadMemory()
    const entry = { path: path.basename(filePath), time: Date.now(), size: stat.size }
    const lastFiles = [entry, ...mem.project.lastFiles.filter((f) => f.path !== entry.path)].slice(0, 10)
    await saveMemory({ project: { ...mem.project, lastFiles } })
  } catch {}
}

export async function rememberError(error: string, fix: string): Promise<void> {
  const mem = await loadMemory()
  const lastErrors = [{ error: error.slice(0, 200), fix: fix.slice(0, 200), time: Date.now() }, ...mem.history.lastErrors].slice(0, 10)
  await saveMemory({ history: { ...mem.history, lastErrors } })
}

export async function rememberTask(success: boolean, tokens: number, duration: number): Promise<void> {
  const mem = await loadMemory()
  const totalTasks = mem.history.totalTasks + 1
  const successRate = (mem.history.successRate * mem.history.totalTasks + (success ? 1 : 0)) / totalTasks
  const avgDuration = (mem.stats.avgDuration * mem.history.totalTasks + duration) / totalTasks
  await saveMemory({
    history: { ...mem.history, totalTasks, successRate },
    stats: { totalTokens: mem.stats.totalTokens + tokens, avgDuration },
  })
}

export async function getContextForPrompt(): Promise<string> {
  const mem = await loadMemory()
  const files = mem.project.lastFiles.slice(0, 5).map((f) => f.path).join(", ") || "yok"
  const errors = mem.history.lastErrors.slice(0, 2).map((e) => `${e.error} -> ${e.fix}`).join(" | ") || "yok"
  return `Hafıza: son dosyalar [${files}] | son hatalar [${errors}] | başarı %${(mem.history.successRate * 100).toFixed(0)}`
}
