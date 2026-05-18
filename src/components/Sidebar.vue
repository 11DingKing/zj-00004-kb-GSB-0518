<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from "vue";
import { useRouter } from "vue-router";
import { useDocumentStore } from "../stores/document";
import * as d3 from "d3";

const router = useRouter();
const documentStore = useDocumentStore();

const activeTab = ref<"search" | "backlinks" | "graph" | "snapshots">("search");
const backlinks = ref<any[]>([]);

const graphContainer = ref<HTMLDivElement | null>(null);
let svg: any = null;
let simulation: any = null;

/** 全文搜索结果（来自 document store）。 */
const fullTextResults = computed(() => documentStore.searchResults);
/** 全文搜索关键词（来自 document store）。 */
const fullTextQuery = computed(() => documentStore.searchQuery);

/** 触发全文搜索：根据输入更新 store 中的搜索状态。 */
const handleSearch = async () => {
  const value = documentStore.searchQuery.trim();
  if (value) {
    await documentStore.performFullTextSearch(value);
  } else {
    documentStore.clearSearch();
  }
};

watch(
  () => documentStore.searchQuery,
  async () => {
    await handleSearch();
  },
);

/** 打开指定文档（路由跳转到 /doc/:id）。 */
const handleOpenDocument = (id: string) => {
  router.push(`/doc/${id}`);
};

interface HighlightSegment {
  text: string;
  highlight: boolean;
}

/**
 * 将一段文本按关键词切分为“高亮/非高亮”片段数组（大小写不敏感）。
 */
function buildHighlightSegments(
  text: string,
  query: string,
): HighlightSegment[] {
  const safeQuery = (query || "").trim();
  if (!safeQuery || !text) {
    return [{ text: text || "", highlight: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = safeQuery.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < lowerText.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      segments.push({ text: text.substring(cursor), highlight: false });
      break;
    }

    if (idx > cursor) {
      segments.push({
        text: text.substring(cursor, idx),
        highlight: false,
      });
    }
    segments.push({
      text: text.substring(idx, idx + safeQuery.length),
      highlight: true,
    });
    cursor = idx + safeQuery.length;
  }

  return segments;
}

const handleRestoreSnapshot = async (snapshot: any) => {
  if (confirm("确定要恢复到此版本吗？当前内容将先保存为快照。")) {
    await documentStore.restoreSnapshot(snapshot);
  }
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString();
};

const initGraph = async () => {
  if (!graphContainer.value) return;
  
  const graphData = await documentStore.getGraphData();
  const nodes: any[] = graphData.nodes;
  const links: any[] = graphData.links;
  
  if (nodes.length === 0) return;
  
  const container = graphContainer.value;
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  d3.select(container).selectAll("*").remove();
  
  svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  const isDark = document.documentElement.classList.contains("dark");
  const linkColor = isDark ? "#444" : "#ccc";
  const nodeColor = (group: string) => {
    const colors: Record<string, string> = {
      "/": isDark ? "#6366f1" : "#4f46e5",
      "/工作": isDark ? "#10b981" : "#059669",
      "/个人": isDark ? "#f59e0b" : "#d97706",
    };
    return colors[group] || (isDark ? "#8b5cf6" : "#7c3aed");
  };
  
  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(35));
  
  const link = svg.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", linkColor)
    .attr("stroke-width", 1.5);
  
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("cursor", "pointer")
    .call(d3.drag()
      .on("start", (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    )
    .on("dblclick", (_event: any, d: any) => {
      handleOpenDocument(d.id);
    });
  
  node.append("circle")
    .attr("r", 8)
    .attr("fill", (d: any) => nodeColor(d.group))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);
  
  node.append("text")
    .text((d: any) => d.title)
    .attr("x", 12)
    .attr("y", 4)
    .attr("font-size", "11px")
    .attr("fill", isDark ? "#e5e7eb" : "#374151")
    .attr("pointer-events", "none");
  
  node.append("title")
    .text((d: any) => d.title);
  
  simulation.on("tick", () => {
    link
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);
    
    node.attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);
  });
};

watch(
  () => activeTab.value,
  async (tab) => {
    if (tab === "graph") {
      await nextTick();
      initGraph();
    }
  },
);

watch(
  () => documentStore.documents.length,
  async () => {
    if (activeTab.value === "graph") {
      await nextTick();
      initGraph();
    }
  },
);

onMounted(() => {
  const handleResize = async () => {
    if (activeTab.value === "graph") {
      await nextTick();
      initGraph();
    }
  };
  window.addEventListener("resize", handleResize);
  
  onBeforeUnmount(() => {
    window.removeEventListener("resize", handleResize);
    if (simulation) simulation.stop();
  });
});
</script>

<template>
  <div class="sidebar">
    <div class="search-top">
      <input
        v-model="documentStore.searchQuery"
        placeholder="全文搜索：标题 / 正文 / 标签"
        @input="handleSearch"
      />
    </div>

    <div class="tabs">
      <button
        v-for="tab in ['search', 'backlinks', 'graph', 'snapshots']"
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab as any"
      >
        {{
          tab === "search"
            ? "搜索"
            : tab === "backlinks"
              ? "反向链接"
              : tab === "graph"
                ? "关系图"
                : "版本历史"
        }}
      </button>
    </div>

    <div class="tab-content">
      <div v-if="activeTab === 'search'" class="search-panel">
        <div class="results">
          <div
            v-for="result in fullTextResults"
            :key="result.document.id"
            class="result-item"
            @click="handleOpenDocument(result.document.id)"
          >
            <div class="result-title">
              <span
                v-for="(segment, index) in buildHighlightSegments(
                  result.document.title,
                  fullTextQuery
                )"
                :key="index"
                :class="{ highlight: segment.highlight }"
              >{{ segment.text }}</span>
            </div>
            <div class="result-snippet">
              <span
                v-for="(segment, index) in buildHighlightSegments(
                  result.snippet,
                  fullTextQuery
                )"
                :key="index"
                :class="{ highlight: segment.highlight }"
              >{{ segment.text }}</span>
            </div>
          </div>
          <div
            v-if="fullTextQuery && fullTextResults.length === 0"
            class="no-results"
          >
            未找到匹配的文档
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'backlinks'" class="backlinks-panel">
        <div v-if="backlinks.length === 0" class="empty">暂无反向链接</div>
        <div
          v-for="backlink in backlinks"
          :key="backlink.sourceId"
          class="backlink-item"
          @click="handleOpenDocument(backlink.sourceId)"
        >
          <div class="backlink-title">{{ backlink.sourceTitle }}</div>
          <div class="backlink-count">{{ backlink.occurrences }} 次引用</div>
        </div>
      </div>

      <div v-if="activeTab === 'graph'" class="graph-panel">
        <div ref="graphContainer" class="graph-container"></div>
      </div>

      <div v-if="activeTab === 'snapshots'" class="snapshots-panel">
        <div v-if="documentStore.snapshots.length === 0" class="empty">
          暂无版本历史
        </div>
        <div
          v-for="snapshot in documentStore.snapshots"
          :key="snapshot.id"
          class="snapshot-item"
        >
          <div class="snapshot-time">{{ formatDate(snapshot.createdAt) }}</div>
          <button @click="handleRestoreSnapshot(snapshot)">恢复</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 300px;
  background-color: var(--sidebar-bg);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-top {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.search-top input {
  width: 100%;
}

.highlight {
  background-color: #fff3a3;
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.tabs button {
  flex: 1;
  border: none;
  border-radius: 0;
  padding: 12px 8px;
  font-size: 0.85rem;
}

.tabs button.active {
  background-color: var(--hover-bg);
  border-bottom: 2px solid var(--accent-color);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.search-panel input {
  width: 100%;
  margin-bottom: 12px;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item,
.backlink-item,
.snapshot-item {
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.result-item:hover,
.backlink-item:hover {
  background: var(--hover-bg);
}

.result-title,
.backlink-title,
.snapshot-time {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.result-snippet {
  font-size: 0.8rem;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.backlink-count {
  font-size: 0.75rem;
  color: #888;
}

.snapshot-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.snapshot-item button {
  font-size: 0.8rem;
  padding: 4px 8px;
}

.empty,
.no-results {
  text-align: center;
  color: #888;
  padding: 40px 20px;
  font-size: 0.9rem;
}

.graph-panel {
  position: relative;
  height: 100%;
  min-height: 400px;
}

.graph-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
