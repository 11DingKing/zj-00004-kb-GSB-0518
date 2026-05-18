<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'
import { exportToZip, importFromZip } from '../utils/export'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const documentStore = useDocumentStore()

const searchQuery = ref('')
const selectedIndex = ref(0)

const commands = computed(() => {
  const baseCommands = [
    { id: 'new', label: '新建文档', action: handleNewDocument, icon: '📄' },
    { id: 'export', label: '导出知识库为 ZIP', action: handleExport, icon: '📤' },
    { id: 'import', label: '导入 ZIP 文件', action: handleImport, icon: '📥' },
    { id: 'theme', label: '切换主题 (明暗)', action: handleToggleTheme, icon: '🌙' }
  ]
  
  if (!searchQuery.value.trim()) return baseCommands
  
  const query = searchQuery.value.toLowerCase()
  return baseCommands.filter(cmd => 
    cmd.label.toLowerCase().includes(query)
  )
})

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, commands.value.length - 1)
    return
  }
  
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    return
  }
  
  if (e.key === 'Enter' && commands.value.length > 0) {
    commands.value[selectedIndex.value].action()
    emit('close')
  }
}

async function handleNewDocument() {
  const title = prompt('请输入文档标题:', '新文档')
  if (title) {
    const doc = await documentStore.createDocument(title)
    router.push(`/doc/${doc.id}`)
  }
}

async function handleExport() {
  await exportToZip()
}

async function handleImport() {
  await importFromZip()
  await documentStore.initialize()
}

function handleToggleTheme() {
  const isDark = document.documentElement.classList.contains('dark')
  if (isDark) {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  } else {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  }
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
        placeholder="输入命令..."
        autofocus
        class="palette-input"
      />
      <div class="palette-list">
        <div
          v-for="(cmd, index) in commands"
          :key="cmd.id"
          class="palette-item"
          :class="{ active: index === selectedIndex }"
          @click="cmd.action(); emit('close')"
        >
          <span class="cmd-icon">{{ cmd.icon }}</span>
          <span class="cmd-label">{{ cmd.label }}</span>
        </div>
        <div v-if="commands.length === 0" class="empty-results">
          未找到匹配的命令
        </div>
      </div>
      <div class="palette-hints">
        <span>↑↓ 导航</span>
        <span>↵ 执行</span>
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

.cmd-icon {
  font-size: 1.2rem;
}

.cmd-label {
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
