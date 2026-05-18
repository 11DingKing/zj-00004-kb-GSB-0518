<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const router = useRouter()
const documentStore = useDocumentStore()

const contextMenu = ref<{ x: number; y: number; documentId?: string } | null>(null)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const draggedItem = ref<string | null>(null)

const sortedDocuments = computed(() => {
  const source = documentStore.tagFilter
    ? documentStore.filteredDocuments
    : documentStore.documents
  return [...source].sort((a, b) =>
    a.title.localeCompare(b.title)
  )
})

const tagFilterLabel = computed(() => {
  return documentStore.tagFilter || ""
})

const handleTagFilterChange = (event: Event) => {
  const select = event.target as HTMLSelectElement
  documentStore.setTagFilter(select.value)
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
      <select
        class="tag-filter"
        :value="tagFilterLabel"
        @change="handleTagFilterChange"
      >
        <option value="">按标签过滤</option>
        <option
          v-for="tag in documentStore.allTags"
          :key="tag"
          :value="tag"
        >#{{ tag }}</option>
      </select>
    </div>
    <div class="tree-items">
      <div
        v-for="doc in sortedDocuments"
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
          <span class="item-title">{{ doc.title }}</span>
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

.tag-filter {
  padding: 4px 8px;
  font-size: 0.85rem;
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
</style>
