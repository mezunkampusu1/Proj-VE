/**
 * Ortak Alan doküman içeriği (Tiptap/ProseMirror JSON) → düz metin /
 * Markdown / HTML dönüştürücüleri (§ dışa aktarma). Word (.docx) ve
 * yazdırma/PDF için ayrı yollar kullanılır (bkz. export/route.ts ve
 * print/page.tsx) çünkü onlar farklı kütüphaneler/mekanizmalar gerektirir
 * (`docx` paketi ve tarayıcının "Yazdır → PDF olarak kaydet" özelliği).
 *
 * Basitleştirme notu: bu dönüştürücüler StarterKit + bu projede kullanılan
 * eklentilerin (LinkedTaskItem, DocumentMention, Table, Highlight, vb.)
 * ürettiği düğüm/işaret adlarını kapsar (bkz. collaborative-editor.tsx).
 * Tanınmayan bir düğüm türüyle karşılaşılırsa yalnızca alt içeriği basılır
 * (veri kaybı değil, biçim kaybı olur) — bilinmeyen bir düğüm dışa
 * aktarmayı tamamen bozmamalı.
 */

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function childText(node: PMNode): string {
  return (node.content || []).map((c) => toPlainText(c)).join("");
}

export function toPlainText(node: PMNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return `@${(node.attrs?.label as string) || ""}`;
  if (node.type === "image") return `[${(node.attrs?.alt as string) || "görsel"}]`;

  const inner = (node.content || []).map(toPlainText);

  switch (node.type) {
    case "doc":
      return inner.join("\n\n");
    case "paragraph":
      return inner.join("");
    case "heading":
      return inner.join("");
    case "blockquote":
      return inner.join("\n");
    case "codeBlock":
      return inner.join("");
    case "bulletList":
    case "orderedList":
      return (node.content || [])
        .map((li, i) => {
          const prefix = node.type === "orderedList" ? `${i + 1}. ` : "- ";
          return prefix + toPlainText(li).trim();
        })
        .join("\n");
    case "taskList":
      return (node.content || []).map((li) => toPlainText(li)).join("\n");
    case "listItem":
    case "taskItem": {
      const checkbox = node.type === "taskItem" ? (node.attrs?.checked ? "[x] " : "[ ] ") : "";
      return checkbox + inner.join(" ").trim();
    }
    case "table":
      return (node.content || []).map(toPlainText).join("\n");
    case "tableRow":
      return (node.content || []).map(toPlainText).join(" | ");
    case "tableCell":
    case "tableHeader":
      return inner.join(" ").trim();
    case "horizontalRule":
      return "---";
    default:
      return inner.join("");
  }
}

/** Node'un tüm blok çocuklarını çift satır sonuyla birleştirir (paragraf/başlık/liste vb. bloklar arası). */
export function documentToPlainText(doc: PMNode): string {
  return (doc.content || []).map(toPlainText).join("\n\n").trim();
}

function markdownInline(node: PMNode): string {
  if (node.type === "text") {
    let text = node.text || "";
    const marks = node.marks || [];
    if (marks.some((m) => m.type === "code")) text = `\`${text}\``;
    if (marks.some((m) => m.type === "bold")) text = `**${text}**`;
    if (marks.some((m) => m.type === "italic")) text = `_${text}_`;
    if (marks.some((m) => m.type === "strike")) text = `~~${text}~~`;
    const link = marks.find((m) => m.type === "link");
    if (link) text = `[${text}](${(link.attrs?.href as string) || ""})`;
    return text;
  }
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "mention") return `**@${(node.attrs?.label as string) || ""}**`;
  if (node.type === "image") return `![${(node.attrs?.alt as string) || ""}](${(node.attrs?.src as string) || ""})`;
  return (node.content || []).map(markdownInline).join("");
}

export function documentToMarkdown(doc: PMNode): string {
  const lines: string[] = [];

  const walkBlock = (node: PMNode, indent = "") => {
    switch (node.type) {
      case "heading": {
        const level = Math.min(Math.max((node.attrs?.level as number) || 1, 1), 6);
        lines.push(`${"#".repeat(level)} ${(node.content || []).map(markdownInline).join("")}`);
        lines.push("");
        break;
      }
      case "paragraph":
        lines.push(indent + (node.content || []).map(markdownInline).join(""));
        lines.push("");
        break;
      case "blockquote":
        (node.content || []).forEach((c) => {
          const sub = documentToMarkdown({ type: "doc", content: [c] }).trim();
          sub.split("\n").forEach((l) => lines.push(`> ${l}`));
        });
        lines.push("");
        break;
      case "codeBlock":
        lines.push("```");
        lines.push(childText(node));
        lines.push("```");
        lines.push("");
        break;
      case "bulletList":
        (node.content || []).forEach((li) => {
          lines.push(`${indent}- ${(li.content || []).map(markdownInline).join(" ").trim()}`);
        });
        lines.push("");
        break;
      case "orderedList":
        (node.content || []).forEach((li, i) => {
          lines.push(`${indent}${i + 1}. ${(li.content || []).map(markdownInline).join(" ").trim()}`);
        });
        lines.push("");
        break;
      case "taskList":
        (node.content || []).forEach((li) => {
          const checked = li.attrs?.checked ? "x" : " ";
          lines.push(`${indent}- [${checked}] ${(li.content || []).map(markdownInline).join(" ").trim()}`);
        });
        lines.push("");
        break;
      case "table":
        (node.content || []).forEach((row, ri) => {
          const cells = (row.content || []).map((cell) => (cell.content || []).map(markdownInline).join(" ").trim());
          lines.push(`| ${cells.join(" | ")} |`);
          if (ri === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        });
        lines.push("");
        break;
      case "horizontalRule":
        lines.push("---");
        lines.push("");
        break;
      default:
        (node.content || []).forEach((c) => walkBlock(c, indent));
    }
  };

  (doc.content || []).forEach((n) => walkBlock(n));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "//evil.example" gibi protokolden bağımsız dış URL'leri DIŞLAR — yalnızca tek "/" ile başlayan kök-relative yolları kabul eder. */
function isRootRelativeUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/** Paylaşılan/dışa aktarılan HTML'e yazılacak link URL'leri için allow-list — javascript:/data:/vbscript: gibi şemaları reddeder. */
function isSafeLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    isRootRelativeUrl(trimmed) ||
    trimmed.startsWith("#")
  );
}

/** Görsel URL'leri için ayrı, daha dar allow-list — mailto/# link'lerde anlamlı olsa da görsel kaynağı için değildir. */
function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) || isRootRelativeUrl(trimmed);
}

/**
 * `image` node hem inline (paragraf içi metin akışında) hem de block (doc.content'te
 * doğrudan bir eleman olarak — bkz. resizable-image.tsx: @tiptap/extension-image'da
 * `group: "block"`) konumda karşımıza çıkabiliyor. Bu yüzden hem `htmlInline`'dan hem
 * de `documentToHtml`'in block switch'inden aynı güvenli üretim mantığı çağrılır —
 * kopya kod / iki farklı escape davranışı riskini önlemek için tek yerde toplanmıştır.
 */
function renderImageHtml(node: PMNode): string {
  const src = ((node.attrs?.src as string) || "").trim();
  if (!src || !isSafeImageUrl(src)) return "";
  const alt = escapeHtml((node.attrs?.alt as string) || "");
  const width = node.attrs?.width;
  const style =
    typeof width === "number" && Number.isFinite(width) && width > 0
      ? `width:${Math.round(width)}px;height:auto`
      : "max-width:100%;height:auto";
  return `<img src="${escapeHtml(src)}" alt="${alt}" style="${style}" />`;
}

function htmlInline(node: PMNode): string {
  if (node.type === "text") {
    let text = escapeHtml(node.text || "");
    const marks = node.marks || [];
    if (marks.some((m) => m.type === "code")) text = `<code>${text}</code>`;
    if (marks.some((m) => m.type === "bold")) text = `<strong>${text}</strong>`;
    if (marks.some((m) => m.type === "italic")) text = `<em>${text}</em>`;
    if (marks.some((m) => m.type === "underline")) text = `<u>${text}</u>`;
    if (marks.some((m) => m.type === "strike")) text = `<s>${text}</s>`;
    if (marks.some((m) => m.type === "suggestionInsert")) text = `<ins>${text}</ins>`;
    if (marks.some((m) => m.type === "suggestionDelete")) text = `<del>${text}</del>`;
    const link = marks.find((m) => m.type === "link");
    if (link) {
      const href = ((link.attrs?.href as string) || "").trim();
      if (isSafeLinkUrl(href)) text = `<a href="${escapeHtml(href)}">${text}</a>`;
    }
    return text;
  }
  if (node.type === "hardBreak") return "<br/>";
  if (node.type === "mention") return `<strong>@${escapeHtml((node.attrs?.label as string) || "")}</strong>`;
  if (node.type === "image") return renderImageHtml(node);
  return (node.content || []).map(htmlInline).join("");
}

export function documentToHtml(doc: PMNode): string {
  const renderBlock = (node: PMNode): string => {
    switch (node.type) {
      case "heading": {
        const level = Math.min(Math.max((node.attrs?.level as number) || 1, 1), 6);
        return `<h${level}>${(node.content || []).map(htmlInline).join("")}</h${level}>`;
      }
      case "paragraph":
        return `<p>${(node.content || []).map(htmlInline).join("")}</p>`;
      case "blockquote":
        return `<blockquote>${(node.content || []).map(renderBlock).join("")}</blockquote>`;
      case "codeBlock":
        return `<pre><code>${escapeHtml(childText(node))}</code></pre>`;
      case "bulletList":
        return `<ul>${(node.content || []).map((li) => `<li>${(li.content || []).map(renderBlock).join("")}</li>`).join("")}</ul>`;
      case "orderedList":
        return `<ol>${(node.content || []).map((li) => `<li>${(li.content || []).map(renderBlock).join("")}</li>`).join("")}</ol>`;
      case "taskList":
        return `<ul class="task-list">${(node.content || [])
          .map((li) => `<li><input type="checkbox" disabled ${li.attrs?.checked ? "checked" : ""}/> ${(li.content || []).map(renderBlock).join("")}</li>`)
          .join("")}</ul>`;
      case "table":
        return `<table>${(node.content || []).map(renderBlock).join("")}</table>`;
      case "tableRow":
        return `<tr>${(node.content || []).map(renderBlock).join("")}</tr>`;
      case "tableCell":
        return `<td>${(node.content || []).map(renderBlock).join("")}</td>`;
      case "tableHeader":
        return `<th>${(node.content || []).map(renderBlock).join("")}</th>`;
      case "horizontalRule":
        return "<hr/>";
      case "image":
        return renderImageHtml(node);
      case "listItem":
      case "taskItem":
        return (node.content || []).map(renderBlock).join("");
      default:
        return (node.content || []).map(htmlInline).join("");
    }
  };

  return (doc.content || []).map(renderBlock).join("\n");
}
