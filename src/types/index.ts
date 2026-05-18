export interface DocumentMeta {
  id: string
  title: string
  tags: string[]
  path: string
  updatedAt: number
  createdAt: number
}

export interface Folder {
  id: string
  name: string
  path: string
  parentId: string | null
  children: (Folder | DocumentMeta)[]
  type: 'folder'
}

export interface Snapshot {
  id: string
  documentId: string
  content: string
  createdAt: number
}

export interface ImageBlob {
  id: string
  name: string
  type: string
  blob: Blob
  size: number
  createdAt: number
}

export interface BacklinkInfo {
  sourceId: string
  sourceTitle: string
  occurrences: number
}

export interface SearchResult {
  document: DocumentMeta
  snippet: string
  score: number
  matches: {
    indices: [number, number][]
  }
}
