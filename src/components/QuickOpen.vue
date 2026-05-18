<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select'): void
}>()

const router = useRouter()
const documentStore = useDocumentStore()

const searchQuery = ref('')
const selectedIndex = ref(0)

const filteredDocuments = computed(() => {
  if (!searchQuery.value.trim()) return documentStore.documents
  
  const query = searchQuery.value.toLowerCase()
  return documentStore.documents.filter(doc => 
    doc.title.toLowerCase().includes(query)
  )
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredDocuments.value.length - 1)
    return
  }
  
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    return
  }
  
  if (e.key === 'Enter' && filteredDocuments.value.length > 0) {
    const doc = filteredDocuments.value[selectedIndex.value]
    router.push(`/doc/${doc.id}`)
    emit('select')
    emit('close')
  }
}

const handleSelect = (id: string) => {
  router.push(`/doc/${id}`)
  emit('select')
  emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="palette-overlay" @click="emit('close')">
    <div class="palette-container" @click.stop>
      <input 
        v-model="searchQuery"
        placeholder="输入文件名..."
        autofocus
        class="palette-input"
      />
      <div class="palette-list">
        <div
          v-for="(doc, index) in filteredDocuments"
          :key="doc.id"
          class="palette-item"
          :class="{ active: index === selectedIndex }"
          @click="handleSelect(doc.id)"
        >
          <span class="doc-icon">📄</span>
          <span class="doc-title">{{ doc.title }}</span>
        </div>
        <div v-if="filteredDocuments.length === 0" class="empty-results">
          未找到匹配的文档
        </div>
      </div>
      <div class="palette-hints">
        <span>↑↓ 导航</span>
        <span>↵ 打开</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 10000;
}

.palette-container {
  width: 500px;
  background: var(--bg-color);
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.palette-input {
  width: 100%;
  padding: 16px 20px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  font-size: 1rem;
  background: transparent;
}

.palette-input:focus {
  outline: none;
}

.palette-list {
  max-height: 300px;
  overflow-y: auto;
}

.palette-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  gap: 12px;
}

.palette-item:hover,
.palette-item.active {
  background: var(--hover-bg);
}

.doc-icon {
  font-size: 1.2rem;
}

.doc-title {
  font-size: 0.95rem;
}

.empty-results {
  padding: 40px 20px;
  text-align: center;
  color: #888;
}

.palette-hints {
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 12px;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: #888;
}
</style>
