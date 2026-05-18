import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  DocumentMeta,
  Snapshot,
  SearchResult,
  FullTextSearchResult,
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
import Fuse from "fuse.js";

export const useDocumentStore = defineStore("document", () => {
  const documents = ref<DocumentMeta[]>([]);
  const currentDocument = ref<DocumentMeta | null>(null);
  const currentContent = ref("");
  const snapshots = ref<Snapshot[]>([]);
  const isInitialized = ref(false);
  const searchScrollTarget = ref<string | null>(null);

  const documentsMap = computed(() => {
    const map = new Map<string, DocumentMeta>();
    documents.value.forEach((doc) => map.set(doc.id, doc));
    return map;
  });

  const documentTitles = computed(() => {
    return documents.value.map((doc) => doc.title);
  });

  const allTags = computed(() => {
    const tagSet = new Set<string>();
    documents.value.forEach((doc) => {
      doc.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
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

  async function searchDocuments(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const fuse = new Fuse(documents.value, {
      keys: ["title", "tags", "path"],
      includeScore: true,
      includeMatches: true,
      threshold: 0.4,
    });

    const results = fuse.search(query);

    return await Promise.all(
      results.map(async (result) => {
        const content = (await getDocFromDB(result.item.id)) || "";
        const snippet = extractSnippet(content, query);

        return {
          document: result.item,
          snippet,
          score: result.score || 1,
          matches: {
            indices: (result.matches || []).flatMap((m) => m.indices || []),
          },
        };
      }),
    );
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

  async function fullTextSearch(
    query: string,
  ): Promise<FullTextSearchResult[]> {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results: FullTextSearchResult[] = [];

    for (const doc of documents.value) {
      const titleMatch = doc.title.toLowerCase().includes(lowerQuery);
      const content = (await getDocFromDB(doc.id)) || "";
      const lowerContent = content.toLowerCase();

      const contentMatchIndex = lowerContent.indexOf(lowerQuery);
      if (!titleMatch && contentMatchIndex === -1) continue;

      const matchPositions: number[] = [];
      let searchFrom = 0;
      while (searchFrom < lowerContent.length) {
        const idx = lowerContent.indexOf(lowerQuery, searchFrom);
        if (idx === -1) break;
        matchPositions.push(idx);
        searchFrom = idx + 1;
      }

      const snippet = extractSnippet(content, query);
      const highlightedSnippet = highlightSnippet(content, query);

      let score = 1.0;
      if (titleMatch) score -= 0.4;
      score -= matchPositions.length * 0.05;
      score = Math.max(0, score);

      results.push({
        document: doc,
        snippet,
        highlightedSnippet,
        matchPositions,
        score,
      });
    }

    results.sort((a, b) => a.score - b.score);
    return results;
  }

  function highlightSnippet(content: string, query: string): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuery);
    if (idx === -1) {
      const text = content.substring(0, 200);
      return escapeHtml(text) + (content.length > 200 ? "..." : "");
    }

    const start = Math.max(0, idx - 60);
    const end = Math.min(content.length, idx + query.length + 60);
    const before = content.substring(start, idx);
    const match = content.substring(idx, idx + query.length);
    const after = content.substring(idx + query.length, end);

    let result = "";
    if (start > 0) result += "...";
    result += escapeHtml(before);
    result += `<mark class="search-highlight">${escapeHtml(match)}</mark>`;
    result += escapeHtml(after);
    if (end < content.length) result += "...";
    return result;
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function addTag(documentId: string, tag: string): Promise<void> {
    const doc = documents.value.find((d) => d.id === documentId);
    if (!doc || doc.tags.includes(tag)) return;
    doc.tags = [...doc.tags, tag];
    updateDocument(documentId, { tags: doc.tags });
    if (currentDocument.value?.id === documentId) {
      currentDocument.value = { ...currentDocument.value, tags: doc.tags };
    }
  }

  async function removeTag(documentId: string, tag: string): Promise<void> {
    const doc = documents.value.find((d) => d.id === documentId);
    if (!doc) return;
    doc.tags = doc.tags.filter((t) => t !== tag);
    updateDocument(documentId, { tags: doc.tags });
    if (currentDocument.value?.id === documentId) {
      currentDocument.value = { ...currentDocument.value, tags: doc.tags };
    }
  }

  function setSearchScrollTarget(query: string | null): void {
    searchScrollTarget.value = query;
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
    searchScrollTarget,
    documentsMap,
    documentTitles,
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
    fullTextSearch,
    findDocumentByTitle,
    addTag,
    removeTag,
    setSearchScrollTarget,
    getBacklinks,
    getGraphData,
    importDocuments,
    exportAllData,
  };
});
