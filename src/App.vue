<script setup lang="ts">
import { onMounted, onUnmounted, ref, provide } from "vue";
import CommandPalette from "./components/CommandPalette.vue";
import QuickOpen from "./components/QuickOpen.vue";

const isDark = ref(false);
const showCommandPalette = ref(false);
const showQuickOpen = ref(false);

provide("isDark", isDark);

const toggleDarkMode = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
};

provide("toggleDarkMode", toggleDarkMode);

const handleKeydown = (e: KeyboardEvent) => {
  const isCmd = e.metaKey || e.ctrlKey;

  if (isCmd && e.key === "k") {
    e.preventDefault();
    showCommandPalette.value = !showCommandPalette.value;
    showQuickOpen.value = false;
  }

  if (isCmd && e.key === "p") {
    e.preventDefault();
    showQuickOpen.value = !showQuickOpen.value;
    showCommandPalette.value = false;
  }
};

onMounted(() => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    isDark.value = true;
    document.documentElement.classList.add("dark");
  }

  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="app">
    <router-view />
    <CommandPalette
      v-if="showCommandPalette"
      @close="showCommandPalette = false"
    />
    <QuickOpen
      v-if="showQuickOpen"
      @close="showQuickOpen = false"
      @select="showQuickOpen = false"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}
</style>
