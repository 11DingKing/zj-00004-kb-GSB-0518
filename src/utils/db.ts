import { openDB, IDBPDatabase } from 'idb'
import type { Snapshot, ImageBlob } from '../types'

const DB_NAME = 'offline-kb'
const DB_VERSION = 1

interface KBDB {
  documents: {
    key: string
    value: string
    indexes: { 'by-id': string }
  }
  snapshots: {
    key: string
    value: Snapshot
    indexes: { 'by-document': string }
  }
  images: {
    key: string
    value: ImageBlob
    indexes: { 'by-id': string }
  }
}

let db: IDBPDatabase<KBDB> | null = null

export async function initDB(): Promise<IDBPDatabase<KBDB>> {
  if (db) return db
  
  db = await openDB<KBDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('documents')) {
        const docStore = database.createObjectStore('documents', { keyPath: 'id' })
        docStore.createIndex('by-id', 'id', { unique: true })
      }
      
      if (!database.objectStoreNames.contains('snapshots')) {
        const snapStore = database.createObjectStore('snapshots', { keyPath: 'id' })
        snapStore.createIndex('by-document', 'documentId')
      }
      
      if (!database.objectStoreNames.contains('images')) {
        const imgStore = database.createObjectStore('images', { keyPath: 'id' })
        imgStore.createIndex('by-id', 'id', { unique: true })
      }
    }
  })
  
  return db
}

export async function saveDocument(id: string, content: string): Promise<void> {
  const database = await initDB()
  await database.put('documents', { id, content })
}

export async function getDocument(id: string): Promise<string | null> {
  const database = await initDB()
  const doc = await database.get('documents', id)
  return doc?.content || null
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await initDB()
  await database.delete('documents', id)
  
  const snapshots = await database.getAllFromIndex('snapshots', 'by-document', id)
  for (const snap of snapshots) {
    await database.delete('snapshots', snap.id)
  }
}

export async function saveSnapshot(documentId: string, content: string): Promise<Snapshot> {
  const database = await initDB()
  const snapshot: Snapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    documentId,
    content,
    createdAt: Date.now()
  }
  
  await database.put('snapshots', snapshot)
  
  const allSnapshots = await database.getAllFromIndex('snapshots', 'by-document', documentId)
  if (allSnapshots.length > 50) {
    const sorted = allSnapshots.sort((a, b) => a.createdAt - b.createdAt)
    const toDelete = sorted.slice(0, sorted.length - 50)
    for (const snap of toDelete) {
      await database.delete('snapshots', snap.id)
    }
  }
  
  return snapshot
}

export async function getSnapshots(documentId: string): Promise<Snapshot[]> {
  const database = await initDB()
  const snapshots = await database.getAllFromIndex('snapshots', 'by-document', documentId)
  return snapshots.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveImage(blob: Blob, name: string): Promise<ImageBlob> {
  const database = await initDB()
  const image: ImageBlob = {
    id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type: blob.type,
    blob,
    size: blob.size,
    createdAt: Date.now()
  }
  
  await database.put('images', image)
  return image
}

export async function getImage(id: string): Promise<ImageBlob | null> {
  const database = await initDB()
  return await database.get('images', id)
}

export async function deleteImage(id: string): Promise<void> {
  const database = await initDB()
  await database.delete('images', id)
}

export async function getAllImages(): Promise<ImageBlob[]> {
  const database = await initDB()
  return await database.getAll('images')
}
