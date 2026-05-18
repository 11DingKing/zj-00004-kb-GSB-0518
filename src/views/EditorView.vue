<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'
import TreeView from '../components/TreeView.vue'
import Editor from '../components/Editor.vue'
import Sidebar from '../components/Sidebar.vue'
import { seedData } from '../utils/seed'

const route = useRoute()
const router = useRouter()
const documentStore = useDocumentStore()

/** 是否显示侧边栏 */
const showSidebar = ref(true)
/** 新标签输入框内容 */
const newTagInput = ref('')
/** 是否显示标签输入框 */
const showTagInput = ref(false)
/** 标签输入框 DOM 引用 */
const tagInputRef = ref<HTMLInputElement | null>(null)
/** 需要滚动到的位置（从搜索结果跳转时使用） */
const scrollPosition = ref<number | null>(null)
/** 自动保存定时器 */
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 全局键盘快捷键处理
 * 支持 Cmd/Ctrl + S 手动保存
 */
const handleKeydown = (e: KeyboardEvent) => {
  const isCmd = e.metaKey || e.ctrlKey
  
  if (isCmd && e.key === 's') {
    e.preventDefault()
    documentStore.saveCurrentDocument()
  }
}

/**
 * 处理搜索结果选择事件
 * 保存需要滚动到的位置，待文档加载后自动滚动
 * @param _id - 文档 ID（未使用）
 * @param position - 需要滚动到的字符位置
 */
const handleSearchSelect = (_id: string, position: number) => {
  scrollPosition.value = position
}

watch(() => route.params.id, async (id) => {
  if (id) {
    try {
      await documentStore.openDocument(String(id))
      if (scrollPosition.value !== null) {
        setTimeout(() => {
          scrollPosition.value = null
        }, 500)
      }
    } catch (error) {
      console.error('打开文档失败:', error)
    }
  }
}, { immediate: true })

watch(() => documentStore.currentContent, () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  autoSaveTimer = setTimeout(() => {
    documentStore.saveCurrentDocument()
  }, 1000)
})

/**
 * 添加标签到当前文档
 * 从输入框获取标签名，添加后清空输入框并隐藏
 */
const handleAddTag = () => {
  if (!newTagInput.value.trim() || !documentStore.currentDocument) return
  
  documentStore.addTagToDocument(
    documentStore.currentDocument.id,
    newTagInput.value.trim()
  )
  newTagInput.value = ''
  showTagInput.value = false
}

/**
 * 从当前文档移除指定标签
 * @param tag - 要移除的标签名称
 */
const handleRemoveTag = (tag: string) => {
  if (!documentStore.currentDocument) return
  documentStore.removeTagFromDocument(documentStore.currentDocument.id, tag)
}

/**
 * 标签输入框键盘事件处理
 * Enter 确认添加，Escape 取消
 * @param e - 键盘事件
 */
const handleTagInputKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleAddTag()
  } else if (e.key === 'Escape') {
    showTagInput.value = false
    newTagInput.value = ''
  }
}

/**
 * 获取标签的颜色样式
 * 基于标签名 hash 自动生成 HSL 颜色
 * @param tag - 标签名称
 * @returns 包含背景色和文字颜色的样式对象
 */
const getTagStyle = (tag: string) => {
  const tagColor = documentStore.getTagColor(tag)
  return {
    backgroundColor: tagColor.backgroundColor,
    color: tagColor.color
  }
}

onMounted(async () => {
  try {
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
  } catch (error) {
    console.error('初始化失败:', error)
  }
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
      <TreeView @search-select="handleSearchSelect" />
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
      
      <div v-if="documentStore.currentDocument" class="tags-bar">
        <div class="tags-container">
          <span 
            v-for="tag in documentStore.currentDocument.tags" 
            :key="tag" 
            class="tag-item"
            :style="getTagStyle(tag)"
          >
            {{ tag }}
            <button class="tag-remove" @click="handleRemoveTag(tag)">×</button>
          </span>
          <div v-if="showTagInput" class="tag-input-wrapper">
            <input
              ref="tagInputRef"
              v-model="newTagInput"
              @blur="handleAddTag"
              @keydown="handleTagInputKeydown"
              placeholder="输入标签..."
              class="tag-input"
              autofocus
            />
          </div>
          <button v-else class="add-tag-btn" @click="showTagInput = true">
            + 添加标签
          </button>
        </div>
      </div>
      
      <Editor 
        v-if="documentStore.currentDocument" 
        :scroll-to-position="scrollPosition"
        @scrolled="scrollPosition = null"
      />
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

.tags-bar {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--sidebar-bg);
}

.tags-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.tag-remove {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input-wrapper {
  display: inline-flex;
}

.tag-input {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 0.8rem;
  width: 120px;
}

.tag-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.add-tag-btn {
  background: transparent;
  border: 1px dashed var(--border-color);
  color: #888;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.add-tag-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
}
</style>
