<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentStore } from '../stores/document'

const router = useRouter()
const documentStore = useDocumentStore()

onMounted(async () => {
  await documentStore.initialize()
  
  if (documentStore.documents.length > 0) {
    router.push(`/doc/${documentStore.documents[0].id}`)
  }
})
</script>

<template>
  <div class="home">
    <div class="loading">
      加载中...
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: var(--bg-color);
}

.loading {
  font-size: 1.5rem;
  color: var(--text-color);
}
</style>
