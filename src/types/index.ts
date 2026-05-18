export interface DocumentMeta {
  id: string;
  title: string;
  tags: string[];
  path: string;
  updatedAt: number;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  children: (Folder | DocumentMeta)[];
  type: "folder";
}

export interface Snapshot {
  id: string;
  documentId: string;
  content: string;
  createdAt: number;
}

export interface ImageBlob {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  size: number;
  createdAt: number;
}

export interface BacklinkInfo {
  sourceId: string;
  sourceTitle: string;
  occurrences: number;
}

export interface SearchResult {
  document: DocumentMeta;
  snippet: string;
  score: number;
  matches: {
    indices: [number, number][];
  };
}

export interface FullTextSearchResult {
  document: DocumentMeta;
  snippet: string;
  highlightedSnippet: string;
  matchPositions: number[];
  score: number;
}

export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 75%)`;
}

export function tagColorDark(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
