import { marked } from "marked";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { useDocumentStore } from "../stores/document";
import { useRouter } from "vue-router";

let router: ReturnType<typeof useRouter> | null = null;

export function setRouter(r: ReturnType<typeof useRouter>) {
  router = r;
}

mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
});

marked.setOptions({
  breaks: true,
  gfm: true,
});

const customRenderer = new marked.Renderer();

customRenderer.link = (href, title, text) => {
  if (href && href.startsWith("kb://image/")) {
    const imageId = href.replace("kb://image/", "");
    return `<img src="kb://image/${imageId}" alt="${text}" data-image-id="${imageId}" />`;
  }
  return `<a href="${href}" title="${title || ""}">${text}</a>`;
};

export async function renderMarkdown(content: string): Promise<string> {
  const documentStore = useDocumentStore();

  let processedContent = content.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, title) => {
      const doc = documentStore.findDocumentByTitle(title);
      if (doc) {
        return `<a href="#" class="internal-link" data-doc-id="${doc.id}" data-doc-title="${title}">[[${title}]]</a>`;
      }
      return `<span class="internal-link broken" data-doc-title="${title}">[[${title}]]</span>`;
    },
  );

  const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
  const mermaidMatches: {
    index: number;
    length: number;
    diagram: string;
    placeholder: string;
  }[] = [];
  let match;
  let placeholderIndex = 0;

  while ((match = mermaidRegex.exec(processedContent)) !== null) {
    const placeholder = `__MERMAID_PLACEHOLDER_${placeholderIndex++}__`;
    mermaidMatches.push({
      index: match.index,
      length: match[0].length,
      diagram: match[1],
      placeholder,
    });
    processedContent = processedContent.replace(match[0], placeholder);
  }

  let html = await marked.parse(processedContent, { renderer: customRenderer });

  for (const m of mermaidMatches) {
    try {
      const { svg } = await mermaid.render(
        `mermaid-${Date.now()}-${Math.random()}`,
        m.diagram,
      );
      html = html.replace(
        m.placeholder,
        `<div class="mermaid-diagram">${svg}</div>`,
      );
    } catch (error) {
      html = html.replace(
        m.placeholder,
        `<div class="mermaid-error">Mermaid 图表渲染错误</div>`,
      );
    }
  }

  const codeRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
  let codeMatch;

  while ((codeMatch = codeRegex.exec(html)) !== null) {
    const language = codeMatch[1] || "text";
    const code = codeMatch[2];
    html = html.replace(
      codeMatch[0],
      `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`,
    );
  }

  const imageRegex = /<img src="kb:\/\/image\/([^"]+)"([^>]*)\/?>/g;
  let imgMatch;

  while ((imgMatch = imageRegex.exec(html)) !== null) {
    const imageId = imgMatch[1];
    const imageUrl = await documentStore.getImageUrl(imageId);
    if (imageUrl) {
      html = html.replace(
        imgMatch[0],
        `<img src="${imageUrl}"${imgMatch[2]} />`,
      );
    } else {
      html = html.replace(
        imgMatch[0],
        `<span class="image-broken">[图片已丢失]</span>`,
      );
    }
  }

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-doc-id", "data-doc-title", "data-image-id"],
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function setupLinkHandlers(container: HTMLElement) {
  container.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;

    if (
      target.classList.contains("internal-link") &&
      !target.classList.contains("broken")
    ) {
      e.preventDefault();
      const docId = target.getAttribute("data-doc-id");
      if (docId && router) {
        router.push(`/doc/${docId}`);
      }
    }

    if (target.classList.contains("broken")) {
      const docTitle = target.getAttribute("data-doc-title");
      if (docTitle) {
        if (confirm(`文档 "${docTitle}" 不存在，是否创建？`)) {
          const documentStore = useDocumentStore();
          const newDoc = await documentStore.createDocument(docTitle);
          if (router) {
            router.push(`/doc/${newDoc.id}`);
          }
        }
      }
    }
  });
}
