import { saveDocument } from './db'
import { generateId, saveDocuments } from './storage'
import type { DocumentMeta } from '../types'

interface SeedDoc {
  title: string
  content: string
  tags: string[]
  path: string
}

const seedDocs: SeedDoc[] = [
  {
    title: '欢迎使用离线知识库',
    path: '/',
    tags: ['入门', '说明'],
    content: `# 欢迎使用离线知识库

这是一个完全离线的个人知识管理应用，类似于 Obsidian 的简化版本。

## 主要功能

- 📝 **Markdown 编辑器** - 实时预览，支持双向链接
- 🔗 **双向链接** - 使用 [[文档标题]] 语法链接到其他文档
- 📂 **文件管理** - 拖拽排序、右键菜单新建/重命名/删除
- 🔍 **全文搜索** - 快速找到你需要的内容
- 📊 **Mermaid 图表** - 支持流程图、时序图等
- 📸 **图片上传** - 拖放图片自动保存
- 💾 **版本历史** - 自动保存快照，支持回滚
- 📤 **导入导出** - ZIP 格式完整备份

## 快捷键

- **Cmd/Ctrl + K** - 打开命令面板
- **Cmd/Ctrl + P** - 快速打开文件
- **Cmd/Ctrl + S** - 手动保存

## 开始使用

1. 查看 [[如何使用双向链接]] 了解链接系统
2. 浏览 [[Mermaid 图表示例]] 学习图表语法
3. 查看 [[代码块语法]] 了解代码高亮功能
4. 使用 [[快捷键指南]] 提高效率

祝你使用愉快！`
  },
  {
    title: '如何使用双向链接',
    path: '/',
    tags: ['教程', '链接'],
    content: `# 如何使用双向链接

双向链接是知识库的核心功能，让你轻松关联不同的想法。

## 基本语法

使用 \`[[文档标题]]\` 格式创建链接：

- [[欢迎使用离线知识库]] - 链接到首页
- [[Mermaid 图表示例]] - 查看图表示例

## 自动补全

当你输入 \`[[\` 时，编辑器会自动显示已有文档列表供你选择。

## 新建链接

如果链接的文档不存在，点击时会提示是否创建新文档。

## 反向链接

右侧面板的"反向链接"标签会显示哪些文档引用了当前文档。

## 最佳实践

1. 使用清晰的文档标题
2. 在相关文档之间建立链接
3. 定期查看反向链接发现新关联

参考文档：
- [[代码块语法]]
- [[快捷键指南]]`
  },
  {
    title: 'Mermaid 图表示例',
    path: '/',
    tags: ['教程', '图表'],
    content: `# Mermaid 图表示例

支持多种 Mermaid 图表语法，让你的文档更加生动。

## 流程图

\`\`\`mermaid
graph TD
    A[开始] --> B{是否有问题?}
    B -->|是| C[查找解决方案]
    B -->|否| D[继续工作]
    C --> E[测试]
    E --> B
    D --> F[结束]
\`\`\`

## 时序图

\`\`\`mermaid
sequenceDiagram
    用户->>编辑器: 输入 Markdown
    编辑器->>渲染引擎: 转换内容
    渲染引擎-->>用户: 实时预览
\`\`\`

## 类图

\`\`\`mermaid
classDiagram
    class Document {
        +String title
        +String content
        +Date updatedAt
        +save()
    }
    class Folder {
        +String name
        +Document[] children
        +addDocument()
    }
    Document <|-- Folder
\`\`\`

## 甘特图

\`\`\`mermaid
gantt
    title 项目开发计划
    dateFormat  YYYY-MM-DD
    section 设计
    需求分析           :done,    des1, 2024-01-01,2024-01-05
    架构设计           :done,    des2, 2024-01-06,2024-01-10
    section 开发
    前端开发           :active,  dev1, 2024-01-11, 15d
    后端开发           :         dev2, 2024-01-11, 20d
    section 测试
    功能测试           :         test1, after dev1, 5d
\`\`\`

相关文档：
- [[如何使用双向链接]]
- [[代码块语法]]`
  },
  {
    title: '代码块语法',
    path: '/',
    tags: ['教程', '代码'],
    content: `# 代码块语法

支持多种编程语言的语法高亮。

## JavaScript

\`\`\`javascript
// 双向链接解析函数
function parseLinks(content) {
  const regex = /\\[\\[([^\\]]+)\\]\\]/g;
  const links = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    links.push({
      title: match[1],
      position: match.index
    });
  }
  
  return links;
}
\`\`\`

## Python

\`\`\`python
def calculate_similarity(text1, text2):
    """计算两个文本的相似度"""
    set1 = set(text1.lower().split())
    set2 = set(text2.lower().split())
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    return intersection / union if union > 0 else 0
\`\`\`

## TypeScript

\`\`\`typescript
interface DocumentMeta {
  id: string;
  title: string;
  tags: string[];
  path: string;
  updatedAt: number;
  createdAt: number;
}

async function createDocument(
  title: string, 
  content: string
): Promise<DocumentMeta> {
  const now = Date.now();
  return {
    id: \`doc_\${now}_\${Math.random().toString(36)}\`,
    title,
    tags: [],
    path: '/',
    createdAt: now,
    updatedAt: now
  };
}
\`\`\`

## CSS

\`\`\`css
.editor-container {
  display: flex;
  height: 100vh;
  gap: 1px;
}

.editor-pane {
  flex: 1;
  overflow: auto;
  border-right: 1px solid var(--border-color);
}
\`\`\`

相关文档：
- [[Mermaid 图表示例]]
- [[快捷键指南]]`
  },
  {
    title: '快捷键指南',
    path: '/',
    tags: ['教程', '效率'],
    content: `# 快捷键指南

掌握这些快捷键可以大大提高你的效率。

## 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| **Cmd/Ctrl + K** | 打开命令面板 |
| **Cmd/Ctrl + P** | 快速打开文件 |
| **Cmd/Ctrl + S** | 手动保存 |
| **Esc** | 关闭弹窗 |

## 编辑器快捷键

| 快捷键 | 功能 |
|--------|------|
| **Cmd/Ctrl + Z** | 撤销 |
| **Cmd/Ctrl + Y** | 重做 |
| **Cmd/Ctrl + X** | 剪切 |
| **Cmd/Ctrl + C** | 复制 |
| **Cmd/Ctrl + V** | 粘贴 |
| **Cmd/Ctrl + A** | 全选 |

## 导航快捷键

| 快捷键 | 功能 |
|--------|------|
| **↑/↓** | 在列表中导航 |
| **Enter** | 选择/执行 |
| **Page Up/Down** | 滚动页面 |

## 命令面板

按 **Cmd/Ctrl + K** 打开命令面板，可以：

- 新建文档
- 导出知识库
- 导入知识库
- 切换主题

## 快速打开

按 **Cmd/Ctrl + P** 快速打开文件，支持模糊搜索。

相关文档：
- [[欢迎使用离线知识库]]
- [[如何使用双向链接]]`
  },
  {
    title: '项目管理笔记',
    path: '/工作',
    tags: ['工作', '项目'],
    content: `# 项目管理笔记

记录项目开发中的重要信息和决策。

## 项目概述

这是一个 [[离线知识库]] 应用的开发项目。

### 技术栈

- **前端**: Vue 3 + Vite + TypeScript
- **状态管理**: Pinia
- **路由**: Vue Router
- **存储**: IndexedDB + localStorage

## 里程碑

1. ✅ 基础框架搭建
2. ✅ 编辑器实现
3. ✅ 双向链接功能
4. ⬜ 关系图可视化
5. ⬜ 移动端适配

## 待办事项

- [ ] 优化搜索性能
- [ ] 添加标签管理
- [ ] 实现关系图谱
- [ ] 支持模板功能

## 会议记录

### 2024年1月15日

讨论了 [[如何使用双向链接]] 的实现方案，决定采用：
- 简洁的 \`[[标题]]\` 语法
- 实时预览中的可点击链接
- 反向链接追踪

相关文档：
- [[技术架构文档]]
- [[设计思路]]`
  },
  {
    title: '技术架构文档',
    path: '/工作',
    tags: ['工作', '技术'],
    content: `# 技术架构文档

详细说明系统的技术架构和设计决策。

## 整体架构

\`\`\`mermaid
graph TB
    UI[Vue 3 组件层] --> Store[Pinia 状态管理]
    Store --> DB[IndexedDB 存储层]
    Store --> Local[localStorage 元数据]
    
    UI --> Editor[CodeMirror 6 编辑器]
    UI --> Preview[Markdown 预览]
    
    Editor --> Marked[Marked 解析器]
    Marked --> DOMPurify[DOMPurify 清理]
    DOMPurify --> Preview
    
    Preview --> Mermaid[Mermaid 渲染]
    Preview --> Shiki[Shiki 代码高亮]
\`\`\`

## 数据存储策略

### localStorage (元数据)

存储文档标题、标签、路径等，用于快速搜索：

- 优势：读取速度快，同步 API
- 限制：存储空间有限 (~5MB)

### IndexedDB (内容存储)

存储实际的 Markdown 内容、图片 Blob、版本快照：

- 优势：大容量存储，异步 API
- 支持：Blob 存储、事务、索引

## 核心模块

### 1. 文档管理模块
- 负责文档的 CRUD 操作
- 处理版本快照
- 管理导入导出

### 2. 编辑器模块
- CodeMirror 6 集成
- 双向链接自动补全
- 图片拖放上传

### 3. 渲染模块
- Markdown 解析
- Mermaid 图表
- 代码高亮

## 依赖关系

参见 [[项目管理笔记]] 了解项目进度。`
  },
  {
    title: '读书笔记',
    path: '/个人',
    tags: ['个人', '阅读'],
    content: `# 读书笔记

记录阅读过程中的思考和感悟。

## 最近阅读

### 《深度工作》- Cal Newport

**核心观点：**
- 深度工作是在无干扰状态下的专注工作
- 大多数人因持续分心而无法深度工作
- 刻意练习是提升能力的关键

**行动清单：**
- [ ] 每天安排 2 小时深度工作时间
- [ ] 使用 [[离线知识库]] 记录深度思考
- [ ] 减少社交媒体使用

### 《原子习惯》- James Clear

**关键要点：**
1. 习惯的改变从身份认同开始
2. 环境设计比意志力更重要
3. 2 分钟法则帮助启动新习惯

**我的应用：**
- 每天早上先写 10 分钟日记
- 将手机放在另一个房间
- 使用番茄工作法保持专注

## 阅读清单

- [ ] 《思考，快与慢》
- [ ] 《穷查理宝典》
- [x] 《深度工作》
- [x] 《原子习惯》

相关思考：
- [[设计思路]] - 关于知识管理的思考`
  },
  {
    title: '设计思路',
    path: '/个人',
    tags: ['个人', '思考'],
    content: `# 设计思路

关于知识管理和个人效率的一些思考。

## 为什么做这个应用？

### 问题

1. **现有的笔记应用**
   - 太复杂（Notion）
   - 太贵（Obsidian Sync）
   - 数据在云端（安全担忧）

2. **我的需求**
   - 完全离线可用
   - 数据在我掌控中
   - 简洁但功能完整

### 解决方案

创建一个轻量级但功能强大的 [[离线知识库]]：
- 纯前端，无需后端
- IndexedDB 本地存储
- 支持双向链接
- 导入导出自由

## 设计原则

### 1. 本地优先
- 数据存在浏览器
- 不需要账号
- 可以完全离线使用

### 2. 标准格式
- Markdown 存储内容
- ZIP 导出备份
- 数据不被锁定

### 3. 渐进式功能
- 核心功能：编辑、链接、搜索
- 高级功能：图表、版本、关系图
- 按需加载，保持轻量

## 未来想法

- [ ] 插件系统
- [ ] 主题定制
- [ ] 模板功能
- [ ] 移动端优化

参考：
- [[技术架构文档]]
- [[读书笔记]]`
  },
  {
    title: '常用模板',
    path: '/',
    tags: ['模板', '工具'],
    content: `# 常用模板

这里是一些可以复制使用的文档模板。

## 会议记录模板

\`\`\`
# 会议记录 - [会议主题]

**日期**: YYYY-MM-DD  
**参会人**: 张三, 李四, 王五

## 议题

1. 议题一
2. 议题二

## 讨论内容

### 议题一

要点记录...

### 议题二

要点记录...

## 决议

- [ ] 张三负责 A 任务
- [ ] 李四负责 B 任务

## 下次会议

- 时间：待定
- 主题：待定

## 相关文档

- [[相关文档链接]]
\`\`\`

## 项目计划模板

\`\`\`
# 项目计划 - [项目名称]

## 概述

简要描述项目目标和范围。

## 里程碑

| 里程碑 | 预计时间 | 状态 |
|--------|----------|------|
| 需求分析 | 第1周 | ⬜ |
| 设计阶段 | 第2周 | ⬜ |
| 开发阶段 | 第3-4周 | ⬜ |
| 测试上线 | 第5周 | ⬜ |

## 任务清单

- [ ] 任务一
- [ ] 任务二
- [ ] 任务三

## 风险

1. 风险一：描述
   - 缓解措施：...

## 相关链接

- [[项目管理笔记]]
- [[技术架构文档]]
\`\`\`

## 日记模板

\`\`\`
# [YYYY-MM-DD] 日记

## 今日成就

- 

## 今日挑战

- 

## 明日计划

- [ ] 
- [ ] 

## 思考与感悟

...

## 灵感记录

- 

## 相关文档

- [[读书笔记]]
- [[设计思路]]
\`\`\`

如何使用这些模板？参考 [[如何使用双向链接]] 了解链接语法。`
  }
]

export async function seedData(): Promise<void> {
  const now = Date.now()
  const documents: DocumentMeta[] = []
  
  for (let i = 0; i < seedDocs.length; i++) {
    const doc = seedDocs[i]
    const id = generateId()
    
    const meta: DocumentMeta = {
      id,
      title: doc.title,
      tags: doc.tags,
      path: doc.path,
      createdAt: now - (seedDocs.length - i) * 1000,
      updatedAt: now - (seedDocs.length - i) * 500
    }
    
    documents.push(meta)
    await saveDocument(id, doc.content)
  }
  
  saveDocuments(documents)
}
