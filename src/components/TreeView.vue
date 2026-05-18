<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'
import type { SearchResult } from '../types'

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'searchSelect', id: string, position: number): void
}>()

const router = useRouter()
const documentStore = useDocumentStore()

const contextMenu = ref<{ x: number; y: number; documentId?: string } | null>(null)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const draggedItem = ref<string | null>(null)
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const selectedTag = ref('')

let searchTimer: ReturnType<typeof setTimeout> | null = null

const filteredDocuments = computed(() => {
  let docs = [...documentStore.documents]
  
  if (selectedTag.value) {
    docs = docs.filter(doc => doc.tags.includes(selectedTag.value))
  }
  
  return docs.sort((a, b) => a.title.localeCompare(b.title))
})

const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)

const handleSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  
  searchTimer = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      searchResults.value = await documentStore.searchDocuments(searchQuery.value)
    } else {
      searchResults.value = []
    }
  }, 150)
}

watch(searchQuery, handleSearch)

const highlightText = (text: string, query: string) => {
  if (!query.trim()) return text
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

const handleSearchResultClick = (result: SearchResult) => {
  const contentMatch = result.matchPositions.find(m => m.field === 'content')
  const position = contentMatch ? contentMatch.start : 0
  
  emit('searchSelect', result.document.id, position)
  router.push(`/doc/${result.document.id}`)
  searchQuery.value = ''
  searchResults.value = []
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

const getTagStyle = (tag: string) => {
  const tagColor = documentStore.getTagColor(tag)
  return {
    backgroundColor: tagColor.backgroundColor,
    color: tagColor.color
  }
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
    </div>
    
    <div class="search-section">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索文档标题和内容..."
        class="search-input"
      />
    </div>
    
    <div class="tag-filter-section" v-if="documentStore.allTags.length > 0">
      <select v-model="selectedTag" class="tag-filter">
        <option value="">全部标签</option>
        <option 
          v-for="tag in documentStore.allTagsWithColor" 
          :key="tag.name" 
          :value="tag.name"
        >
          {{ tag.name }}
        </option>
      </select>
    </div>
    
    <div v-if="hasSearchQuery" class="search-results">
      <div v-if="searchResults.length === 0" class="no-results">
        未找到匹配的文档
      </div>
      <div
        v-for="result in searchResults"
        :key="result.document.id"
        class="search-result-item"
        @click="handleSearchResultClick(result)"
      >
        <div 
          class="result-title"
          v-html="highlightText(result.document.title, searchQuery)"
        ></div>
        <div 
          class="result-snippet"
          v-html="highlightText(result.snippet, searchQuery)"
        ></div>
        <div class="result-tags" v-if="result.document.tags.length > 0">
          <span 
            v-for="tag in result.document.tags" 
            :key="tag" 
            class="mini-tag"
            :style="getTagStyle(tag)"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
    
    <div v-else class="tree-items">
      <div
        v-for="doc in filteredDocuments"
        :key="doc.id"
        class="tree-item"
        :class="{ 
          active: documentStore.currentDocument?.id === doc.id,
          dragging: draggedItem === doc.id
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
          <div class="item-content">
            <span class="item-title">{{ doc.title }}</span>
            <div class="item-tags" v-if="doc.tags.length > 0">
              <span 
                v-for="tag in doc.tags.slice(0, 3)" 
                :key="tag" 
                class="mini-tag"
                :style="getTagStyle(tag)"
              >
                {{ tag }}
              </span>
              <span v-if="doc.tags.length > 3" class="more-tags">
                +{{ doc.tags.length - 3 }}
              </span>
            </div>
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
}

.tree-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.search-section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 0.9rem;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.tag-filter-section {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.tag-filter {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 0.85rem;
  box-sizing: border-box;
  cursor: pointer;
}

.tag-filter:focus {
  outline: none;
  border-color: var(--accent-color);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.search-result-item {
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 4px;
  transition: background-color 0.15s;
  border: 1px solid transparent;
}

.search-result-item:hover {
  background-color: var(--hover-bg);
  border-color: var(--border-color);
}

.result-title {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.result-snippet {
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

:deep(.search-highlight) {
  background-color: #fef08a;
  color: #854d0e;
  padding: 0 2px;
  border-radius: 2px;
}

.no-results {
  text-align: center;
  color: #888;
  padding: 40px 20px;
  font-size: 0.9rem;
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

.tree-item.active .mini-tag {
  opacity: 0.9;
}

.tree-item.dragging {
  opacity: 0.5;
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title {
  font-size: 0.9rem;
}

.item-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.mini-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.more-tags {
  font-size: 0.7rem;
  color: #888;
}

.tree-item.active .more-tags {
  color: rgba(255, 255, 255, 0.7);
}

.rename-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 0.9rem;
  box-sizing: border-box;
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
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  font-size: 0.9rem;
}

.context-menu button:hover {
  background: var(--hover-bg);
}
</style>
