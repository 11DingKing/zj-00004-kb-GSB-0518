<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from "vue";
import { useDocumentStore } from "../stores/document";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { renderMarkdown } from "../utils/markdown";
import { tagColor, tagColorDark } from "../types";

const documentStore = useDocumentStore();

const editorContainer = ref<HTMLDivElement | null>(null);
const previewContainer = ref<HTMLDivElement | null>(null);
const newTagInput = ref("");
let editorView: EditorView | null = null;
let isDark = document.documentElement.classList.contains("dark");

const currentTags = computed(() => {
  return documentStore.currentDocument?.tags || [];
});

const isDarkMode = computed(() => document.documentElement.classList.contains("dark"));

const getTagStyle = (tag: string) => {
  return {
    backgroundColor: isDarkMode.value ? tagColorDark(tag) : tagColor(tag),
  };
};

const addTag = () => {
  const tag = newTagInput.value.trim();
  if (!tag || !documentStore.currentDocument) return;
  if (currentTags.value.includes(tag)) {
    newTagInput.value = "";
    return;
  }
  documentStore.addTag(documentStore.currentDocument.id, tag);
  newTagInput.value = "";
};

const removeTag = (tag: string) => {
  if (!documentStore.currentDocument) return;
  documentStore.removeTag(documentStore.currentDocument.id, tag);
};

const linkCompletion = (context: {
  state: EditorState;
  pos: number;
  explicit: boolean;
}) => {
  const { state, pos } = context;
  const line = state.doc.lineAt(pos);
  const text = line.text;
  const from = line.from;

  const linkMatch = text.match(/\[\[([^\]]*)$/);
  if (linkMatch) {
    const start = from + text.lastIndexOf("[[");
    const query = linkMatch[1];

    const options = documentStore.documentTitles
      .filter((title) => title.toLowerCase().includes(query.toLowerCase()))
      .map((title) => ({
        label: title,
        detail: "文档",
        apply: `[[${title}]]`,
        type: "link",
      }));

    return {
      from: start,
      options,
      validFor: /^\[\[[^\]]*$/,
    };
  }

  return null;
};

const updateContent = () => {
  if (!editorView) return;
  documentStore.currentContent = editorView.state.doc.toString();
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();

  if (e.dataTransfer?.files) {
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith("image/")) {
        const markdown = await documentStore.uploadImage(file);
        if (editorView) {
          const pos = editorView.state.selection.main.head;
          editorView.dispatch({
            changes: { from: pos, insert: "\n" + markdown + "\n" },
          });
        }
      }
    }
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
};

const scrollToSearchMatch = () => {
  const query = documentStore.searchScrollTarget;
  if (!query || !editorView) return;

  const content = editorView.state.doc.toString();
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);

  if (idx !== -1) {
    editorView.dispatch({
      selection: { anchor: idx },
      scrollIntoView: true,
    });
  }

  documentStore.setSearchScrollTarget(null);
};

const setupEditor = () => {
  if (!editorContainer.value) return;

  const extensions = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    autocompletion({ override: [linkCompletion] }),
    EditorView.updateListener.of(() => {
      updateContent();
    }),
    EditorView.domEventHandlers({
      drop: (e: DragEvent) => {
        handleDrop(e);
      },
      dragover: handleDragOver,
    }),
  ];

  if (isDark) {
    extensions.push(oneDark);
  }

  const state = EditorState.create({
    doc: documentStore.currentContent,
    extensions,
  });

  editorView = new EditorView({
    state,
    parent: editorContainer.value,
  });
};

watch(
  () => documentStore.currentContent,
  async (content) => {
    if (previewContainer.value) {
      previewContainer.value.innerHTML = await renderMarkdown(content);
    }
  },
  { immediate: true },
);

watch(
  () => documentStore.currentDocument?.id,
  () => {
    if (editorView && documentStore.currentDocument) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: documentStore.currentContent,
        },
      });
    }
  },
);

watch(
  () => documentStore.searchScrollTarget,
  async (target) => {
    if (target) {
      await nextTick();
      scrollToSearchMatch();
    }
  },
);

onMounted(() => {
  isDark = document.documentElement.classList.contains("dark");
  setupEditor();
});

onBeforeUnmount(() => {
  editorView?.destroy();
});
</script>

<template>
  <div class="editor-wrapper">
    <div v-if="documentStore.currentDocument" class="tag-bar">
      <div class="tag-list">
        <span
          v-for="tag in currentTags"
          :key="tag"
          class="tag-chip"
          :style="getTagStyle(tag)"
        >
          {{ tag }}
          <button class="tag-remove" @click="removeTag(tag)">✕</button>
        </span>
        <input
          v-model="newTagInput"
          class="tag-input"
          placeholder="添加标签..."
          @keyup.enter="addTag"
        />
      </div>
    </div>
    <div class="editor-container">
      <div ref="editorContainer" class="editor-pane"></div>
      <div ref="previewContainer" class="preview-pane"></div>
    </div>
  </div>
</template>

<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.tag-bar {
  padding: 6px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  min-height: 36px;
  background: var(--sidebar-bg);
}

.tag-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.tag-remove {
  border: none;
  background: transparent;
  padding: 0 2px;
  font-size: 0.65rem;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  line-height: 1;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input {
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-size: 0.75rem;
  min-width: 80px;
  max-width: 140px;
}

.tag-input:focus {
  outline: none;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  flex: 1;
  overflow: auto;
}

.editor-pane {
  border-right: 1px solid var(--border-color);
  height: 100%;
}

.preview-pane {
  padding: 20px 40px;
  font-size: 1rem;
  line-height: 1.7;
}

.preview-pane :deep(h1),
.preview-pane :deep(h2),
.preview-pane :deep(h3),
.preview-pane :deep(h4),
.preview-pane :deep(h5),
.preview-pane :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
}

.preview-pane :deep(h1) {
  font-size: 2em;
}
.preview-pane :deep(h2) {
  font-size: 1.5em;
}
.preview-pane :deep(h3) {
  font-size: 1.25em;
}

.preview-pane :deep(p) {
  margin: 1em 0;
}

.preview-pane :deep(code) {
  background: var(--hover-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "Fira Code", monospace;
}

.preview-pane :deep(pre) {
  background: var(--hover-bg);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

.preview-pane :deep(pre code) {
  background: transparent;
  padding: 0;
}

.preview-pane :deep(a) {
  color: var(--accent-color);
  text-decoration: none;
}

.preview-pane :deep(a:hover) {
  text-decoration: underline;
}

.preview-pane :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.preview-pane :deep(ul),
.preview-pane :deep(ol) {
  padding-left: 1.5em;
  margin: 1em 0;
}

.preview-pane :deep(blockquote) {
  margin: 1em 0;
  padding-left: 1em;
  border-left: 4px solid var(--border-color);
  color: #888;
}

.preview-pane :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.preview-pane :deep(th),
.preview-pane :deep(td) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
}

.preview-pane :deep(th) {
  background: var(--hover-bg);
}

.preview-pane :deep(.internal-link) {
  color: var(--accent-color);
  cursor: pointer;
}

.preview-pane :deep(.internal-link:hover) {
  text-decoration: underline;
}

.preview-pane :deep(.mermaid-diagram) {
  display: flex;
  justify-content: center;
  margin: 1em 0;
}
</style>
