import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  DocumentMeta,
  Snapshot,
  SearchResult,
  MatchPosition,
  TagWithColor,
} from "../types";
import {
  generateId,
  getDocuments,
  saveDocuments,
  addDocument,
  updateDocument,
  deleteDocumentMeta,
} from "../utils/storage";
import {
  saveDocument as saveDocToDB,
  getDocument as getDocFromDB,
  deleteDocument as deleteDocFromDB,
  saveSnapshot,
  getSnapshots,
  saveImage,
  getImage,
  getAllImages,
} from "../utils/db";

export const useDocumentStore = defineStore("document", () => {
  const documents = ref<DocumentMeta[]>([]);
  const currentDocument = ref<DocumentMeta | null>(null);
  const currentContent = ref("");
  const snapshots = ref<Snapshot[]>([]);
  const isInitialized = ref(false);

  const documentsMap = computed(() => {
    const map = new Map<string, DocumentMeta>();
    documents.value.forEach((doc) => map.set(doc.id, doc));
    return map;
  });

  const documentTitles = computed(() => {
    return documents.value.map((doc) => doc.title);
  });

  async function initialize() {
    if (isInitialized.value) return;

    documents.value = getDocuments();
    isInitialized.value = true;
  }

  async function createDocument(
    title: string,
    path: string = "/",
    content: string = "",
  ): Promise<DocumentMeta> {
    const now = Date.now();
    const meta: DocumentMeta = {
      id: generateId(),
      title,
      tags: [],
      path,
      createdAt: now,
      updatedAt: now,
    };

    addDocument(meta);
    documents.value.push(meta);

    await saveDocToDB(meta.id, content);

    return meta;
  }

  async function openDocument(id: string) {
    const meta = documents.value.find((d) => d.id === id);
    if (!meta) return;

    currentDocument.value = meta;
    currentContent.value = (await getDocFromDB(id)) || "";
    snapshots.value = await getSnapshots(id);
  }

  async function saveCurrentDocument() {
    if (!currentDocument.value) return;

    const now = Date.now();
    const oldContent = (await getDocFromDB(currentDocument.value.id)) || "";

    const diff = calculateDiff(oldContent, currentContent.value);

    if (diff > 50) {
      await saveSnapshot(currentDocument.value.id, oldContent);
      snapshots.value = await getSnapshots(currentDocument.value.id);
    }

    await saveDocToDB(currentDocument.value.id, currentContent.value);

    updateDocument(currentDocument.value.id, { updatedAt: now });
    const index = documents.value.findIndex(
      (d) => d.id === currentDocument.value!.id,
    );
    if (index !== -1) {
      documents.value[index].updatedAt = now;
    }
  }

  function calculateDiff(oldContent: string, newContent: string): number {
    if (oldContent === newContent) return 0;

    const m = oldContent.length;
    const n = newContent.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldContent[i - 1] === newContent[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  async function updateCurrentDocument(updates: Partial<DocumentMeta>) {
    if (!currentDocument.value) return;

    updateDocument(currentDocument.value.id, updates);
    currentDocument.value = { ...currentDocument.value, ...updates };

    const index = documents.value.findIndex(
      (d) => d.id === currentDocument.value!.id,
    );
    if (index !== -1) {
      documents.value[index] = { ...documents.value[index], ...updates };
    }
  }

  async function deleteDocument(id: string) {
    deleteDocumentMeta(id);
    await deleteDocFromDB(id);

    documents.value = documents.value.filter((d) => d.id !== id);

    if (currentDocument.value?.id === id) {
      currentDocument.value = null;
      currentContent.value = "";
    }
  }

  async function restoreSnapshot(snapshot: Snapshot) {
    if (!currentDocument.value) return;

    await saveSnapshot(currentDocument.value.id, currentContent.value);
    currentContent.value = snapshot.content;
    await saveCurrentDocument();
    snapshots.value = await getSnapshots(currentDocument.value.id);
  }

  async function uploadImage(file: File): Promise<string> {
    const image = await saveImage(file, file.name);
    return `![${file.name}](kb://image/${image.id})`;
  }

  async function getImageUrl(id: string): Promise<string | null> {
    const image = await getImage(id);
    if (!image) return null;
    return URL.createObjectURL(image.blob);
  }

  /**
   * 全文搜索文档
   * 搜索范围包括标题、正文内容和标签
   * 返回包含匹配位置信息的搜索结果
   * @param query - 搜索关键词
   * @returns 搜索结果数组，按匹配度排序
   */
  async function searchDocuments(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const doc of documents.value) {
      const content = (await getDocFromDB(doc.id)) || "";
      const matchPositions: MatchPosition[] = [];

      const lowerTitle = doc.title.toLowerCase();
      let titleIndex = lowerTitle.indexOf(lowerQuery);
      while (titleIndex !== -1) {
        matchPositions.push({
          field: "title",
          start: titleIndex,
          end: titleIndex + query.length,
          highlightText: doc.title.substring(
            titleIndex,
            titleIndex + query.length,
          ),
        });
        titleIndex = lowerTitle.indexOf(lowerQuery, titleIndex + 1);
      }

      const lowerContent = content.toLowerCase();
      let contentIndex = lowerContent.indexOf(lowerQuery);
      while (contentIndex !== -1) {
        matchPositions.push({
          field: "content",
          start: contentIndex,
          end: contentIndex + query.length,
          highlightText: content.substring(
            contentIndex,
            contentIndex + query.length,
          ),
        });
        contentIndex = lowerContent.indexOf(lowerQuery, contentIndex + 1);
      }

      doc.tags.forEach((tag) => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          const tagIndex = tag.toLowerCase().indexOf(lowerQuery);
          matchPositions.push({
            field: "title",
            start: 0,
            end: query.length,
            highlightText: tag.substring(tagIndex, tagIndex + query.length),
          });
        }
      });

      if (matchPositions.length > 0) {
        const snippet = extractSnippet(content, query);
        const score = matchPositions.some((m) => m.field === "title")
          ? 0.1
          : 0.5;

        results.push({
          document: doc,
          snippet,
          score,
          matches: {
            indices: matchPositions.map(
              (m) => [m.start, m.end] as [number, number],
            ),
          },
          matchPositions,
        });
      }
    }

    results.sort((a, b) => a.score - b.score);
    return results;
  }

  function extractSnippet(content: string, query: string): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) {
      return content.substring(0, 200) + (content.length > 200 ? "..." : "");
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);
    const snippet = content.substring(start, end);

    return (
      (start > 0 ? "..." : "") + snippet + (end < content.length ? "..." : "")
    );
  }

  function findDocumentByTitle(title: string): DocumentMeta | undefined {
    return documents.value.find(
      (d) => d.title.toLowerCase() === title.toLowerCase(),
    );
  }

  async function getBacklinks(
    documentId: string,
  ): Promise<{ sourceId: string; sourceTitle: string; occurrences: number }[]> {
    const backlinks: Map<
      string,
      { sourceId: string; sourceTitle: string; occurrences: number }
    > = new Map();
    const currentDoc = documentsMap.value.get(documentId);
    if (!currentDoc) return [];

    for (const doc of documents.value) {
      if (doc.id === documentId) continue;

      const content = (await getDocFromDB(doc.id)) || "";
      const regex = new RegExp(
        `\\[\\[${escapeRegExp(currentDoc.title)}\\]\\]`,
        "gi",
      );
      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        backlinks.set(doc.id, {
          sourceId: doc.id,
          sourceTitle: doc.title,
          occurrences: matches.length,
        });
      }
    }

    return Array.from(backlinks.values());
  }

  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 计算字符串的 hash 值
   * 用于根据标签名生成稳定的颜色
   * @param str - 输入字符串
   * @returns 非负整数 hash 值
   */
  function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * 根据标签名生成颜色
   * 使用 HSL 色轮，基于标签名 hash 自动分配颜色
   * 保证相同标签始终使用相同颜色
   * @param tagName - 标签名称
   * @returns 包含背景色和文字颜色的对象
   */
  function getTagColor(tagName: string): TagWithColor {
    const hash = hashString(tagName);
    const hue = hash % 360;
    const saturation = 70 + (hash % 15);
    const lightness = 45 + (hash % 10);
    const backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const textLightness = lightness > 50 ? 15 : 90;
    const color = `hsl(${hue}, ${saturation}%, ${textLightness}%)`;
    return { name: tagName, color, backgroundColor };
  }

  /** 所有文档中使用的标签列表（去重并排序） */
  const allTags = computed(() => {
    const tagSet = new Set<string>();
    documents.value.forEach((doc) => {
      doc.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  });

  /** 所有标签及其对应的颜色信息 */
  const allTagsWithColor = computed(() => {
    return allTags.value.map((tag) => getTagColor(tag));
  });

  /**
   * 根据标签过滤文档
   * @param tag - 标签名称，为空时返回所有文档
   * @returns 包含指定标签的文档列表
   */
  function getDocumentsByTag(tag: string): DocumentMeta[] {
    if (!tag) return documents.value;
    return documents.value.filter((doc) => doc.tags.includes(tag));
  }

  /**
   * 为文档添加标签
   * @param documentId - 文档 ID
   * @param tag - 要添加的标签名称
   */
  async function addTagToDocument(documentId: string, tag: string) {
    const doc = documents.value.find((d) => d.id === documentId);
    if (!doc) return;

    const trimmedTag = tag.trim();
    if (!trimmedTag || doc.tags.includes(trimmedTag)) return;

    const newTags = [...doc.tags, trimmedTag];
    updateDocument(documentId, { tags: newTags });
    doc.tags = newTags;

    if (currentDocument.value?.id === documentId) {
      currentDocument.value.tags = newTags;
    }
  }

  /**
   * 从文档移除标签
   * @param documentId - 文档 ID
   * @param tag - 要移除的标签名称
   */
  async function removeTagFromDocument(documentId: string, tag: string) {
    const doc = documents.value.find((d) => d.id === documentId);
    if (!doc) return;

    const newTags = doc.tags.filter((t) => t !== tag);
    updateDocument(documentId, { tags: newTags });
    doc.tags = newTags;

    if (currentDocument.value?.id === documentId) {
      currentDocument.value.tags = newTags;
    }
  }

  interface GraphNode {
    id: string;
    title: string;
    group: string;
  }

  interface GraphLink {
    source: string;
    target: string;
  }

  interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
  }

  async function getGraphData(): Promise<GraphData> {
    const nodes: GraphNode[] = documents.value.map((doc) => ({
      id: doc.id,
      title: doc.title,
      group: doc.path || "/",
    }));

    const nodeMap = new Map(
      documents.value.map((doc) => [doc.title.toLowerCase(), doc.id]),
    );
    const links: GraphLink[] = [];

    for (const doc of documents.value) {
      const content = (await getDocFromDB(doc.id)) || "";
      const linkRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = linkRegex.exec(content)) !== null) {
        const linkedTitle = match[1].toLowerCase();
        const targetId = nodeMap.get(linkedTitle);
        if (targetId && targetId !== doc.id) {
          const exists = links.some(
            (l) =>
              (l.source === doc.id && l.target === targetId) ||
              (l.source === targetId && l.target === doc.id),
          );
          if (!exists) {
            links.push({ source: doc.id, target: targetId });
          }
        }
      }
    }

    return { nodes, links };
  }

  async function importDocuments(
    metas: DocumentMeta[],
    contents: Map<string, string>,
  ) {
    const existingDocs = getDocuments();

    metas.forEach((meta) => {
      const existingIndex = existingDocs.findIndex(
        (d) => d.title === meta.title && d.path === meta.path,
      );

      if (existingIndex !== -1) {
        const existing = existingDocs[existingIndex];
        if (meta.updatedAt > existing.updatedAt) {
          existingDocs[existingIndex] = meta;
        }
      } else {
        existingDocs.push(meta);
      }
    });

    saveDocuments(existingDocs);
    documents.value = existingDocs;

    for (const [id, content] of contents) {
      await saveDocToDB(id, content);
    }
  }

  async function exportAllData(): Promise<{
    metas: DocumentMeta[];
    contents: Map<string, string>;
    images: Map<string, Blob>;
  }> {
    const metas = getDocuments();
    const contents = new Map<string, string>();
    const images = new Map<string, Blob>();

    for (const meta of metas) {
      const content = await getDocFromDB(meta.id);
      if (content) {
        contents.set(meta.id, content);
      }
    }

    const allImages = await getAllImages();
    for (const img of allImages) {
      images.set(img.id, img.blob);
    }

    return { metas, contents, images };
  }

  return {
    documents,
    currentDocument,
    currentContent,
    snapshots,
    isInitialized,
    documentsMap,
    documentTitles,
    allTags,
    allTagsWithColor,
    initialize,
    createDocument,
    openDocument,
    saveCurrentDocument,
    updateCurrentDocument,
    deleteDocument,
    restoreSnapshot,
    uploadImage,
    getImageUrl,
    searchDocuments,
    findDocumentByTitle,
    getBacklinks,
    getGraphData,
    importDocuments,
    exportAllData,
    getTagColor,
    getDocumentsByTag,
    addTagToDocument,
    removeTagFromDocument,
  };
});
