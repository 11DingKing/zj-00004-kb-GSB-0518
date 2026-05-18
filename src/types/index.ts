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

/** 全文搜索结果，包含高亮片段和匹配位置信息 */
export interface FullTextSearchResult {
  document: DocumentMeta;
  snippet: string;
  highlightedSnippet: string;
  matchPositions: number[];
  score: number;
}

/** 根据标签名 hash 计算亮色模式下的 HSL 色轮颜色（饱和度 65%，亮度 75%） */
export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 75%)`;
}

/** 根据标签名 hash 计算暗色模式下的 HSL 色轮颜色（饱和度 55%，亮度 45%） */
export function tagColorDark(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
