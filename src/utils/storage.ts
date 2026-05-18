import type { DocumentMeta } from '../types'

const DOCS_KEY = 'kb_documents'
const FOLDERS_KEY = 'kb_folders'

export function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getDocuments(): DocumentMeta[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveDocuments(docs: DocumentMeta[]): void {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
}

export function addDocument(doc: DocumentMeta): void {
  const docs = getDocuments()
  docs.push(doc)
  saveDocuments(docs)
}

export function updateDocument(id: string, updates: Partial<DocumentMeta>): void {
  const docs = getDocuments()
  const index = docs.findIndex(d => d.id === id)
  if (index !== -1) {
    docs[index] = { ...docs[index], ...updates }
    saveDocuments(docs)
  }
}

export function deleteDocumentMeta(id: string): void {
  const docs = getDocuments()
  const filtered = docs.filter(d => d.id !== id)
  saveDocuments(filtered)
}

export function getFolders(): any[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveFolders(folders: any[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}
