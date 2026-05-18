import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { DocumentMeta, Snapshot, SearchResult } from "../types";
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

  /** 当前搜索关键词（全文搜索）。 */
  const searchQuery = ref("");
  /** 当前搜索结果（全文搜索）。 */
  const searchResults = ref<SearchResult[]>([]);

  /** 当前标签过滤值（null 表示不过滤）。 */
  const tagFilter = ref<string | null>(null);

  /** 按标签过滤后的文档列表。 */
  const filteredDocuments = computed(() => {
    if (!tagFilter.value) return documents.value;
    const tag = tagFilter.value.trim();
    if (!tag) return documents.value;
    return documents.value.filter((doc) => doc.tags.includes(tag));
  });

  /** 所有文档的去重标签集合（按字典序排序）。 */
  const allTags = computed(() => {
    const tagSet = new Set<string>();
    for (const doc of documents.value) {
      for (const tag of doc.tags) {
        const trimmed = tag.trim();
        if (trimmed) tagSet.add(trimmed);
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
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
   * 按关键词搜索文档（历史兼容入口）。
   * 现统一委托给 `performFullTextSearch` 实现。
   */
  async function searchDocuments(query: string): Promise<SearchResult[]> {
    return performFullTextSearch(query);
  }

  /**
   * 对所有文档进行全文搜索（标题 / 标签 / 正文）。
   * 会同步更新 store 中的 `searchQuery` 与 `searchResults`。
   */
  async function performFullTextSearch(query: string): Promise<SearchResult[]> {
    if (!query.trim()) {
      searchQuery.value = "";
      searchResults.value = [];
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const doc of documents.value) {
      const titleIndices = collectMatchIndices(doc.title || "", lowerQuery);
      const tagIndices: [number, number][] = [];
      for (const tag of doc.tags) {
        tagIndices.push(...collectMatchIndices(tag || "", lowerQuery));
      }
      const content = (await getDocFromDB(doc.id)) || "";
      const contentIndices = collectMatchIndices(content, lowerQuery);

      if (
        titleIndices.length === 0 &&
        tagIndices.length === 0 &&
        contentIndices.length === 0
      ) {
        continue;
      }

      let snippet = "";
      if (contentIndices.length > 0) {
        snippet = buildSnippet(content, contentIndices[0], lowerQuery.length);
      } else if (titleIndices.length > 0) {
        snippet = buildSnippet(
          doc.title || "",
          titleIndices[0],
          lowerQuery.length,
        );
      } else {
        const firstTagWithMatch = doc.tags.find((tag) =>
          tag.toLowerCase().includes(lowerQuery),
        );
        snippet = firstTagWithMatch || "";
      }

      results.push({
        document: doc,
        snippet,
        score: 1,
        matches: {
          indices: [...titleIndices, ...tagIndices, ...contentIndices],
        },
      });
    }

    searchQuery.value = query;
    searchResults.value = results;
    return results;
  }

  /** 收集关键词在文本中的所有命中区间（大小写不敏感）。 */
  function collectMatchIndices(
    text: string,
    lowerQuery: string,
  ): [number, number][] {
    if (!text || !lowerQuery) return [];

    const lowerText = text.toLowerCase();
    const indices: [number, number][] = [];
    let cursor = 0;

    while (cursor < lowerText.length) {
      const idx = lowerText.indexOf(lowerQuery, cursor);
      if (idx === -1) break;
      indices.push([idx, idx + lowerQuery.length - 1]);
      cursor = idx + lowerQuery.length;
    }

    return indices;
  }

  /**
   * 根据命中区间构建片段（在命中前后各取一定长度窗口）。
   */
  function buildSnippet(
    text: string,
    matchRange: [number, number],
    matchLength: number,
  ): string {
    const [start] = matchRange;
    const windowSize = 60;
    const snippetStart = Math.max(0, start - windowSize);
    const snippetEnd = Math.min(text.length, start + matchLength + windowSize);
    const snippet = text.substring(snippetStart, snippetEnd);

    return (
      (snippetStart > 0 ? "..." : "") +
      snippet +
      (snippetEnd < text.length ? "..." : "")
    );
  }

  function findDocumentByTitle(title: string): DocumentMeta | undefined {
    return documents.value.find(
      (d) => d.title.toLowerCase() === title.toLowerCase(),
    );
  }

  /**
   * 根据标签名生成稳定的 HSL 颜色。
   * 通过标签名的哈希作为 HSL 的 hue，保证同标签颜色一致。
   */
  function getTagColor(tag: string): string {
    const normalized = tag.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    const saturation = 60 + (Math.abs(hash >> 3) % 20);
    const lightness = 45 + (Math.abs(hash >> 5) % 15);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * 从正文内容中提取 `#tag` 形式的标签。
   * 支持空格或行首分隔符，如 `#abc #def` 会被识别为两个标签。
   */
  function extractTagsFromText(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/(?:^|\s)#([^\s#]+)/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.trim().slice(1))));
  }

  /** 获取指定文档的标签列表（副本）。 */
  function getDocumentTags(id: string): string[] {
    const doc = documents.value.find((d) => d.id === id);
    return doc ? [...doc.tags] : [];
  }

  /** 为指定文档添加标签（会去重并同步持久化）。 */
  async function addTag(id: string, tag: string): Promise<void> {
    const trimmed = tag.trim();
    if (!trimmed) return;

    const doc = documents.value.find((d) => d.id === id);
    if (!doc) return;
    if (doc.tags.includes(trimmed)) return;

    const tags = [...doc.tags, trimmed];
    updateDocument(id, { tags });
    doc.tags = tags;

    if (currentDocument.value?.id === id) {
      currentDocument.value = { ...currentDocument.value, tags };
    }
  }

  /** 从指定文档移除标签并同步持久化。 */
  async function removeTag(id: string, tag: string): Promise<void> {
    const trimmed = tag.trim();
    if (!trimmed) return;

    const doc = documents.value.find((d) => d.id === id);
    if (!doc) return;

    const tags = doc.tags.filter((t) => t !== trimmed);
    updateDocument(id, { tags });
    doc.tags = tags;

    if (currentDocument.value?.id === id) {
      currentDocument.value = { ...currentDocument.value, tags };
    }
  }

  /**
   * 根据正文内容同步文档标签。
   * 将正文中的 `#tag` 集合作为文档的 tags（会覆盖）。
   */
  async function syncTagsFromContent(id: string): Promise<string[]> {
    const doc = documents.value.find((d) => d.id === id);
    if (!doc) return [];
    const content = (await getDocFromDB(id)) || "";
    const extracted = extractTagsFromText(content);
    updateDocument(id, { tags: extracted });
    doc.tags = extracted;
    if (currentDocument.value?.id === id) {
      currentDocument.value = { ...currentDocument.value, tags: extracted };
    }
    return extracted;
  }

  /** 设置当前的标签过滤值（传空值会清除过滤）。 */
  function setTagFilter(tag: string | null) {
    tagFilter.value = tag ? tag.trim() : null;
  }

  /** 清空搜索关键词与搜索结果。 */
  function clearSearch() {
    searchQuery.value = "";
    searchResults.value = [];
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
    searchQuery,
    searchResults,
    tagFilter,
    filteredDocuments,
    allTags,
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
    performFullTextSearch,
    findDocumentByTitle,
    getTagColor,
    extractTagsFromText,
    getDocumentTags,
    addTag,
    removeTag,
    syncTagsFromContent,
    setTagFilter,
    clearSearch,
    getBacklinks,
    getGraphData,
    importDocuments,
    exportAllData,
  };
});
