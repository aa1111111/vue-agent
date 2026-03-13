/**
 * 这个文件只做一件事：把“模型输出的纯文本”变成“可在页面上展示的安全 HTML”。
 *
 * 为什么要单独抽出来？
 * - 组件（MessageItem）不需要关心“如何渲染文本”，只负责展示；
 * - 渲染规则统一维护，后续想替换成 markdown-it/marked 也只改这里。
 */

// 把任意字符串做 HTML 转义，避免 v-html 带来的 XSS 风险（核心安全点）。
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 轻量安全渲染：
 * - 支持 ```code``` 代码块（可选第一行语言标识）
 * - 支持行内 `code`
 * - 支持换行
 * - 统一 HTML 转义，避免 XSS
 */
export function renderLiteMarkdown(text) {
  // 统一把输入转成字符串，避免 null/undefined 导致模板或 replace 报错。
  const src = String(text ?? "");

  // 以 ``` 为分隔：偶数段是普通文本，奇数段是代码块内容。
  const parts = src.split(/```/g);
  const html = parts
    .map((part, idx) => {
      if (idx % 2 === 1) {
        // 代码块分支：允许第一行是语言标识，如 ```js
        const lines = part.replace(/^\n+|\n+$/g, "").split("\n");
        const first = lines[0] ?? "";
        const looksLikeLang = /^[a-zA-Z0-9#+.-]{1,20}$/.test(first.trim());
        const code = looksLikeLang
          ? lines.slice(1).join("\n")
          : lines.join("\n");
        const lang = looksLikeLang ? first.trim() : "";

        // 注意：这里仍然对 lang/code 做 escapeHtml，确保安全。
        return `<pre class="code"><div class="code-head">${escapeHtml(
          lang || "code"
        )}</div><code>${escapeHtml(code)}</code></pre>`;
      }

      // 普通文本分支：先整体 escape，再处理行内 `code`，最后把换行变成 <br>。
      const escaped = escapeHtml(part);
      const inline = escaped.replace(/`([^`]+?)`/g, (_m, g1) => {
        return `<code class="inline-code">${g1}</code>`;
      });
      return inline.replace(/\n/g, "<br>");
    })
    .join("");

  // 返回一段可用于 v-html 的字符串。
  return html;
}

