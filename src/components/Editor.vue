<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from "vue";
import { useDocumentStore } from "../stores/document";
import { EditorState, EditorSelection } from "@codemirror/state";
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

const props = defineProps<{
  scrollToPosition?: number | null;
}>();

const emit = defineEmits<{
  (e: "scrolled"): void;
}>();

const documentStore = useDocumentStore();

const editorContainer = ref<HTMLDivElement | null>(null);
const previewContainer = ref<HTMLDivElement | null>(null);
let editorView: EditorView | null = null;
let isDark = document.documentElement.classList.contains("dark");

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

const scrollToPosition = (pos: number) => {
  if (!editorView) return;
  
  const doc = editorView.state.doc;
  const safePos = Math.max(0, Math.min(pos, doc.length));
  
  editorView.dispatch({
    selection: EditorSelection.cursor(safePos),
    scrollIntoView: true,
  });
  
  emit("scrolled");
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
  () => props.scrollToPosition,
  async (pos) => {
    if (pos !== null && pos !== undefined && editorView) {
      await nextTick();
      setTimeout(() => {
        scrollToPosition(pos);
      }, 100);
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
  <div class="editor-container">
    <div ref="editorContainer" class="editor-pane"></div>
    <div ref="previewContainer" class="preview-pane"></div>
  </div>
</template>

<style scoped>
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
