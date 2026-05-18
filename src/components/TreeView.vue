<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'
import type { FullTextSearchResult } from '../types'
import { tagColor, tagColorDark } from '../types'

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const router = useRouter()
const documentStore = useDocumentStore()

const contextMenu = ref<{ x: number; y: number; documentId?: string } | null>(null)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const draggedItem = ref<string | null>(null)

const fullTextQuery = ref('')
const fullTextResults = ref<FullTextSearchResult[]>([])
const isSearchActive = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const tagFilter = ref<string | null>(null)
const showTagDropdown = ref(false)

const isDark = computed(() => document.documentElement.classList.contains('dark'))

const getTagStyle = (tag: string) => {
  return {
    backgroundColor: isDark.value ? tagColorDark(tag) : tagColor(tag),
  }
}

const sortedDocuments = computed(() => {
  let docs = [...documentStore.documents].sort((a, b) =>
    a.title.localeCompare(b.title)
  )
  if (tagFilter.value) {
    docs = docs.filter((d) => d.tags.includes(tagFilter.value!))
  }
  return docs
})

const handleFullTextSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (fullTextQuery.value.trim()) {
      isSearchActive.value = true
      fullTextResults.value = await documentStore.fullTextSearch(fullTextQuery.value)
    } else {
      isSearchActive.value = false
      fullTextResults.value = []
    }
  }, 300)
}

const handleSearchResultClick = (result: FullTextSearchResult) => {
  documentStore.setSearchScrollTarget(fullTextQuery.value)
  router.push(`/doc/${result.document.id}`)
}

const clearSearch = () => {
  fullTextQuery.value = ''
  isSearchActive.value = false
  fullTextResults.value = []
  documentStore.setSearchScrollTarget(null)
}

const toggleTagFilter = (tag: string) => {
  if (tagFilter.value === tag) {
    tagFilter.value = null
  } else {
    tagFilter.value = tag
  }
  showTagDropdown.value = false
}

const clearTagFilter = () => {
  tagFilter.value = null
}

const handleContextMenu = (e: MouseEvent, documentId?: string) => {
  e.preventDefault()
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    documentId
  }
}

const handleClickOutside = () => {
  contextMenu.value = null
}

const handleSelect = (id: string) => {
  router.push(`/doc/${id}`)
  emit('select', id)
}

const handleNewDocument = async () => {
  const title = prompt('请输入文档标题:', '新文档')
  if (title) {
    const doc = await documentStore.createDocument(title)
    router.push(`/doc/${doc.id}`)
  }
  contextMenu.value = null
}

const handleRename = (id: string) => {
  const doc = documentStore.documents.find(d => d.id === id)
  if (doc) {
    editingId.value = id
    editingTitle.value = doc.title
  }
  contextMenu.value = null
}

const confirmRename = () => {
  if (editingId.value && editingTitle.value.trim()) {
    documentStore.updateCurrentDocument({ title: editingTitle.value.trim() })
    const doc = documentStore.documents.find(d => d.id === editingId.value)
    if (doc) {
      doc.title = editingTitle.value.trim()
    }
  }
  editingId.value = null
}

const handleDelete = async (id: string) => {
  if (confirm('确定要删除这个文档吗？')) {
    await documentStore.deleteDocument(id)
    if (documentStore.documents.length > 0) {
      router.push(`/doc/${documentStore.documents[0].id}`)
    }
  }
  contextMenu.value = null
}

const handleDragStart = (e: DragEvent, id: string) => {
  draggedItem.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragEnd = () => {
  draggedItem.value = null
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  draggedItem.value = null
}
</script>

<template>
  <div
    class="tree-view"
    @contextmenu="handleContextMenu($event)"
    @click="handleClickOutside"
  >
    <div class="tree-header">
      <h3>文档目录</h3>
      <div class="search-box">
        <input
          v-model="fullTextQuery"
          placeholder="全文搜索..."
          class="search-input"
          @input="handleFullTextSearchInput"
        />
        <button
          v-if="isSearchActive"
          class="clear-btn"
          @click.stop="clearSearch"
        >
          ✕
        </button>
      </div>
      <div class="tag-filter-area">
        <button
          class="tag-filter-btn"
          @click.stop="showTagDropdown = !showTagDropdown"
        >
          {{ tagFilter ? `标签: ${tagFilter}` : "按标签过滤" }}
          <span
            v-if="tagFilter"
            class="tag-filter-clear"
            @click.stop="clearTagFilter"
            >✕</span
          >
        </button>
        <div v-if="showTagDropdown" class="tag-dropdown" @click.stop>
          <div
            v-if="documentStore.allTags.length === 0"
            class="tag-dropdown-empty"
          >
            暂无标签
          </div>
          <button
            v-for="tag in documentStore.allTags"
            :key="tag"
            class="tag-dropdown-item"
            :class="{ active: tagFilter === tag }"
            @click="toggleTagFilter(tag)"
          >
            <span class="tag-dot" :style="getTagStyle(tag)"></span>
            {{ tag }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="isSearchActive" class="search-results">
      <div class="search-results-header">
        <span>搜索结果 ({{ fullTextResults.length }})</span>
        <button class="clear-btn" @click.stop="clearSearch">清除</button>
      </div>
      <div
        v-for="result in fullTextResults"
        :key="result.document.id"
        class="search-result-item"
        @click="handleSearchResultClick(result)"
      >
        <div class="search-result-title">{{ result.document.title }}</div>
        <div class="search-result-tags" v-if="result.document.tags.length">
          <span
            v-for="tag in result.document.tags"
            :key="tag"
            class="mini-tag"
            :style="getTagStyle(tag)"
            >{{ tag }}</span
          >
        </div>
        <div
          class="search-result-snippet"
          v-html="result.highlightedSnippet"
        ></div>
      </div>
      <div v-if="fullTextResults.length === 0" class="no-results">
        未找到匹配的文档
      </div>
    </div>

    <div v-else class="tree-items">
      <div
        v-for="doc in sortedDocuments"
        :key="doc.id"
        class="tree-item"
        :class="{
          active: documentStore.currentDocument?.id === doc.id,
          dragging: draggedItem === doc.id,
        }"
        draggable="true"
        @click="handleSelect(doc.id)"
        @contextmenu.stop="handleContextMenu($event, doc.id)"
        @dragstart="handleDragStart($event, doc.id)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver"
        @drop="handleDrop"
      >
        <template v-if="editingId === doc.id">
          <input
            v-model="editingTitle"
            @blur="confirmRename"
            @keyup.enter="confirmRename"
            @click.stop
            autofocus
            class="rename-input"
          />
        </template>
        <template v-else>
          <span class="item-title">{{ doc.title }}</span>
          <div class="item-tags" v-if="doc.tags.length">
            <span
              v-for="tag in doc.tags"
              :key="tag"
              class="mini-tag"
              :style="getTagStyle(tag)"
              >{{ tag }}</span
            >
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="contextMenu"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <button @click="handleNewDocument">新建文档</button>
      <template v-if="contextMenu.documentId">
        <button @click="handleRename(contextMenu.documentId!)">重命名</button>
        <button @click="handleDelete(contextMenu.documentId!)">删除</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tree-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.tree-header {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 6px 28px 6px 8px;
  font-size: 0.85rem;
}

.search-box .clear-btn {
  position: absolute;
  right: 4px;
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-size: 0.75rem;
  color: #888;
  cursor: pointer;
}

.search-box .clear-btn:hover {
  color: var(--text-color);
}

.tag-filter-area {
  position: relative;
}

.tag-filter-btn {
  width: 100%;
  text-align: left;
  font-size: 0.8rem;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-filter-clear {
  margin-left: auto;
  font-size: 0.7rem;
  color: #888;
}

.tag-filter-clear:hover {
  color: var(--text-color);
}

.tag-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.tag-dropdown-empty {
  padding: 8px 12px;
  color: #888;
  font-size: 0.8rem;
  text-align: center;
}

.tag-dropdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  text-align: left;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.tag-dropdown-item:hover {
  background: var(--hover-bg);
}

.tag-dropdown-item.active {
  background: var(--accent-color);
  color: white;
}

.tag-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 8px;
}

.search-results-header .clear-btn {
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-size: 0.75rem;
  color: #888;
  cursor: pointer;
}

.search-result-item {
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
  margin-bottom: 6px;
}

.search-result-item:hover {
  background: var(--hover-bg);
}

.search-result-title {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.search-result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.search-result-snippet {
  font-size: 0.8rem;
  color: #888;
  line-height: 1.4;
  word-break: break-all;
}

.search-result-snippet :deep(.search-highlight) {
  background: rgba(251, 191, 36, 0.4);
  color: inherit;
  padding: 1px 2px;
  border-radius: 2px;
}

.mini-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.4;
}

.tree-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
  transition: background-color 0.15s;
}

.tree-item:hover {
  background-color: var(--hover-bg);
}

.tree-item.active {
  background-color: var(--accent-color);
  color: white;
}

.tree-item.dragging {
  opacity: 0.5;
}

.item-title {
  font-size: 0.9rem;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.rename-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 0.9rem;
}

.context-menu {
  position: fixed;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.context-menu button {
  border: none;
  text-align: left;
  padding: 8px 12px;
  border-radius: 4px;
}

.context-menu button:hover {
  background: var(--hover-bg);
}

.no-results {
  text-align: center;
  color: #888;
  padding: 20px;
  font-size: 0.85rem;
}
</style>
