<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'
import TreeView from '../components/TreeView.vue'
import Editor from '../components/Editor.vue'
import Sidebar from '../components/Sidebar.vue'
import { seedData } from '../utils/seed'

const route = useRoute()
const router = useRouter()
const documentStore = useDocumentStore()

const showSidebar = ref(true)
const newTagInput = ref("")
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

/** 当前文档的标签列表（来自 store 的当前文档）。 */
const currentTags = computed(() => {
  return documentStore.currentDocument?.tags || []
})

/** 新增标签：从输入框读取并同步到 store。 */
const handleAddTag = async () => {
  const tag = newTagInput.value.trim().replace(/^#/, "")
  if (!tag) return
  if (documentStore.currentDocument) {
    await documentStore.addTag(documentStore.currentDocument.id, tag)
  }
  newTagInput.value = ""
}

/** 删除标签：调用 store 的 removeTag。 */
const handleRemoveTag = async (tag: string) => {
  if (!documentStore.currentDocument) return
  await documentStore.removeTag(documentStore.currentDocument.id, tag)
}

const handleKeydown = (e: KeyboardEvent) => {
  const isCmd = e.metaKey || e.ctrlKey
  
  if (isCmd && e.key === 's') {
    e.preventDefault()
    documentStore.saveCurrentDocument()
  }
}

watch(() => route.params.id, async (id) => {
  if (id) {
    await documentStore.openDocument(String(id))
  }
}, { immediate: true })

watch(() => documentStore.currentContent, () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  autoSaveTimer = setTimeout(() => {
    documentStore.saveCurrentDocument()
    if (documentStore.currentDocument) {
      documentStore.syncTagsFromContent(documentStore.currentDocument.id)
    }
  }, 1000)
})

onMounted(async () => {
  await documentStore.initialize()
  
  const hasData = localStorage.getItem('kb_has_seed') !== 'true'
  if (hasData || documentStore.documents.length === 0) {
    await seedData()
    await documentStore.initialize()
    localStorage.setItem('kb_has_seed', 'true')
  }
  
  if (!route.params.id && documentStore.documents.length > 0) {
    router.push(`/doc/${documentStore.documents[0].id}`)
  }
  
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="editor-view">
    <div class="sidebar-left" v-if="showSidebar">
      <TreeView />
    </div>
    <div class="main-content">
      <div class="toolbar">
        <button @click="showSidebar = !showSidebar">
          {{ showSidebar ? '隐藏目录' : '显示目录' }}
        </button>
        <div v-if="documentStore.currentDocument" class="doc-info">
          {{ documentStore.currentDocument.title }}
          <span class="updated">
            最后更新: {{ new Date(documentStore.currentDocument.updatedAt).toLocaleString() }}
          </span>
        </div>
      </div>
      <div v-if="documentStore.currentDocument" class="tag-bar">
        <div class="tag-list">
          <span
            v-for="tag in currentTags"
            :key="tag"
            class="tag-chip"
            :style="{ backgroundColor: documentStore.getTagColor(tag) + '22', color: documentStore.getTagColor(tag), borderColor: documentStore.getTagColor(tag) }"
          >
            #{{ tag }}
            <button class="tag-remove" @click="handleRemoveTag(tag)">×</button>
          </span>
        </div>
        <div class="tag-input-wrap">
          <input
            v-model="newTagInput"
            placeholder="输入标签并回车"
            @keyup.enter="handleAddTag"
          />
        </div>
      </div>
      <Editor v-if="documentStore.currentDocument" />
      <div v-else class="empty-state">
        <h2>选择或创建一个文档</h2>
        <p>从左侧目录选择文档或右键新建</p>
      </div>
    </div>
    <Sidebar v-if="showSidebar" />
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.sidebar-left {
  width: 250px;
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 16px;
}

.doc-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.updated {
  font-size: 0.85rem;
  color: #888;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
}

.tag-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 0.8rem;
}

.tag-remove {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.tag-input-wrap {
  flex: 1;
  min-width: 160px;
}

.tag-input-wrap input {
  width: 100%;
}
</style>
