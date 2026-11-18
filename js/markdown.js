// 从旧站 ninocat/js/common.js 迁移过来的 Markdown 渲染器
// 支持：标题/列表/引用/代码块/表格/图片/链接/加粗斜体/分割线
// 以及旧站的自定义标记：->居中<- 、+>折叠<+ 、$行内公式$、代码高亮
(function () {
  function resolveAssetUrl(rawUrl) {
    return String(rawUrl == null ? "" : rawUrl).trim();
  }

  function escapeHtml(input) {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseFrontMatter(markdown) {
    const trimmed = markdown.replace(/^\uFEFF/, "");
    if (!trimmed.startsWith("---\n")) {
      return { meta: {}, body: trimmed };
    }

    const end = trimmed.indexOf("\n---", 4);
    if (end < 0) {
      return { meta: {}, body: trimmed };
    }

    const header = trimmed.slice(4, end).trim();
    const body = trimmed.slice(end + 4).trimStart();
    const meta = {};

    header.split(/\r?\n/).forEach((line) => {
      const sep = line.indexOf(":");
      if (sep < 0) return;
      const key = line.slice(0, sep).trim();
      const value = line.slice(sep + 1).trim();
      meta[key] = value;
    });

    return { meta, body };
  }

  function createMathPlaceholder(latexRaw, displayMode) {
    const latex = String(latexRaw || "").trim();
    if (!latex) return "";
    const escapedLatex = escapeHtml(latex);
    const cls = displayMode ? "math-block" : "math-inline";
    return `<span class="${cls}" data-latex="${escapedLatex}">${escapedLatex}</span>`;
  }

  function extractInlineMathPlaceholders(text) {
    const placeholders = [];
    const replaced = String(text || "").replace(/(^|[^\\])\$(?!\$)([^\n$]+?)\$(?!\$)/g, (m, prefix, expr) => {
      const placeholder = `\uE110${placeholders.length}\uE111`;
      placeholders.push(createMathPlaceholder(expr, false));
      return `${prefix}${placeholder}`;
    });
    return { text: replaced, placeholders };
  }

  function inlineMarkdown(raw) {
    const extracted = extractInlineMathPlaceholders(raw);
    let rendered = extracted.text
      .replace(/->([\s\S]*?)<-/g, '<div class="center-wrap">$1</div>')
      .replace(/-&gt;([\s\S]*?)&lt;-/g, '<div class="center-wrap">$1</div>')
      .replace(/(?:!\[([^\]]*)\])?\+\>([\s\S]*?)\<\+/g, (_m, summary, content) => {
        const label = (summary || '').trim() || '展开折叠内容';
        return '<details class="foldable"><summary>' + label + '</summary>' + content + '</details>';
      })
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
        const resolvedSrc = escapeHtml(resolveAssetUrl(src));
        const isVideo = /\.(mp4|webm|mov)$/i.test(src);
        if (isVideo) {
          return `<video controls preload="metadata" class="video-embed" src="${resolvedSrc}#t=0.001"></video>`;
        }
        return `<img src="${resolvedSrc}" alt="${alt}" loading="lazy" />`;
      })
      .replace(/&lt;(https?:\/\/[^<>\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer noopener">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/==([^=]+)==/g, "<mark>$1</mark>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');

    extracted.placeholders.forEach((html, idx) => {
      rendered = rendered.replace(`\uE110${idx}\uE111`, html);
    });
    return rendered;
  }

  function normalizeCodeLang(raw) {
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return "plain";
    if (text === "c#" || text === "cs" || text === "csharp") return "csharp";
    if (text === "c++" || text === "cpp" || text === "cc" || text === "cxx") return "cpp";
    if (text === "py" || text === "python") return "python";
    if (text === "htm" || text === "html" || text === "xml") return "html";
    if (text === "hlsl") return "hlsl";
    return text;
  }

  function escapeRegExp(input) {
    return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightCode(code, lang) {
    const normalizedLang = normalizeCodeLang(lang);

    if (typeof hljs !== "undefined" && normalizedLang !== "plain") {
      try {
        const result = hljs.highlight(code, { language: normalizedLang, ignoreIllegals: true });
        return result.value.replace(/<span class="(hljs-[^"]+)">/g, (_m, cls) => {
          const map = {
            "hljs-keyword": "tok-kw",
            "hljs-string": "tok-str",
            "hljs-number": "tok-num",
            "hljs-comment": "tok-comment",
            "hljs-built_in": "tok-kw",
            "hljs-type": "tok-kw",
            "hljs-literal": "tok-kw",
            "hljs-title": "tok-tag",
            "hljs-attr": "tok-attr",
            "hljs-meta": "tok-comment",
            "hljs-meta-keyword": "tok-kw",
            "hljs-meta-string": "tok-str",
            "hljs-symbol": "tok-str",
            "hljs-section": "tok-tag",
            "hljs-variable": "tok-kw",
            "hljs-template-variable": "tok-str",
            "hljs-doctag": "tok-comment",
            "hljs-addition": "tok-str",
            "hljs-deletion": "tok-str",
            "hljs-selector-tag": "tok-kw",
            "hljs-selector-id": "tok-tag",
            "hljs-selector-class": "tok-attr",
          };
          return map[cls] ? `<span class="${map[cls]}">` : "<span>";
        });
      } catch (_e) {
        // fall through to custom highlighter
      }
    }

    const protectedHtml = new Map();
    let tokenCounter = 0;
    let text = escapeHtml(code);

    const tokenKey = () => {
      const n = tokenCounter++;
      let x = n;
      let letters = "";
      do {
        letters = String.fromCharCode(65 + (x % 26)) + letters;
        x = Math.floor(x / 26) - 1;
      } while (x >= 0);
      return `\uE000${letters}\uE001`;
    };

    const protect = (pattern, cssToken) => {
      text = text.replace(pattern, (m) => {
        const key = tokenKey();
        protectedHtml.set(key, `<span class="tok-${cssToken}">${m}</span>`);
        return key;
      });
    };

    const highlightKeywords = (keywords) => {
      if (!keywords.length) return;
      const re = new RegExp(`\\b(${keywords.map(escapeRegExp).join("|")})\\b`, "g");
      text = text.replace(re, '<span class="tok-kw">$1</span>');
    };

    if (normalizedLang === "csharp") {
      protect(/\/\*[\s\S]*?\*\//g, "comment");
      protect(/\/\/[^\n]*/g, "comment");
      protect(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "str");
      highlightKeywords([
        "public",
        "private",
        "protected",
        "internal",
        "class",
        "struct",
        "enum",
        "interface",
        "namespace",
        "using",
        "void",
        "int",
        "float",
        "double",
        "decimal",
        "string",
        "bool",
        "var",
        "new",
        "return",
        "if",
        "else",
        "switch",
        "case",
        "for",
        "foreach",
        "while",
        "do",
        "break",
        "continue",
        "null",
        "true",
        "false",
        "static",
        "readonly",
        "const",
        "this",
        "base",
      ]);
    } else if (normalizedLang === "cpp") {
      protect(/\/\*[\s\S]*?\*\//g, "comment");
      protect(/\/\/[^\n]*/g, "comment");
      protect(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "str");
      highlightKeywords([
        "int",
        "float",
        "double",
        "char",
        "bool",
        "void",
        "class",
        "struct",
        "enum",
        "namespace",
        "template",
        "typename",
        "auto",
        "const",
        "constexpr",
        "static",
        "public",
        "private",
        "protected",
        "virtual",
        "override",
        "new",
        "delete",
        "return",
        "if",
        "else",
        "switch",
        "case",
        "for",
        "while",
        "do",
        "break",
        "continue",
        "nullptr",
        "true",
        "false",
      ]);
    } else if (normalizedLang === "hlsl") {
      protect(/\/\*[\s\S]*?\*\//g, "comment");
      protect(/\/\/[^\n]*/g, "comment");
      protect(/"(?:\\.|[^"\\])*"/g, "str");
      highlightKeywords([
        "float",
        "float2",
        "float3",
        "float4",
        "float3x3",
        "float4x4",
        "half",
        "int",
        "uint",
        "bool",
        "Texture2D",
        "SamplerState",
        "cbuffer",
        "struct",
        "return",
        "if",
        "else",
        "for",
        "while",
        "static",
        "const",
        "true",
        "false",
      ]);
    } else if (normalizedLang === "python") {
      protect(/#([^\n]*)/g, "comment");
      protect(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, "str");
      highlightKeywords([
        "def",
        "class",
        "import",
        "from",
        "as",
        "if",
        "elif",
        "else",
        "for",
        "while",
        "try",
        "except",
        "finally",
        "with",
        "return",
        "yield",
        "lambda",
        "pass",
        "break",
        "continue",
        "True",
        "False",
        "None",
      ]);
    } else if (normalizedLang === "html") {
      protect(/&lt;!--[\s\S]*?--&gt;/g, "comment");
      text = text.replace(/(&lt;\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?&gt;)/g, (_m, p1, name, attrs, p4) => {
        const highlightedAttrs = attrs
          .replace(/([a-zA-Z_:][\w:.-]*)(=)/g, '<span class="tok-attr">$1</span>$2')
          .replace(/(&quot;[^&]*?&quot;|'[^']*?')/g, '<span class="tok-str">$1</span>');
        return `${p1}<span class="tok-tag">${name}</span>${highlightedAttrs}${p4}`;
      });
    }

    for (const [key, value] of protectedHtml.entries()) {
      text = text.split(key).join(value);
    }

    return text;
  }

  function markdownToHtml(markdownText) {
    const text = String(markdownText || "").replace(/\r\n/g, "\n");

    // Pre-process foldable blocks: +>...<+ (multi-line, supports nesting)
    const foldableBlocks = [];
    let foldResult = '';
    let depth = 0;
    let segStart = 0;
    let foldLabel = '';
    let contentStart = -1;

    function foldFlush(end) {
      if (end > segStart) foldResult += text.slice(segStart, end);
    }

    for (let pos = 0; pos < text.length - 1; pos++) {
      if (text[pos] === '+' && text[pos + 1] === '>') {
        if (depth === 0) {
          foldFlush(pos);
          const lm = foldResult.match(/!\[([^\]]*)\]$/);
          foldLabel = lm ? lm[1].trim() : '展开折叠内容';
          if (lm) foldResult = foldResult.slice(0, -lm[0].length);
          contentStart = pos + 2;
        }
        depth++;
        pos++;
        continue;
      }
      if (text[pos] === '<' && text[pos + 1] === '+') {
        if (depth > 0) {
          depth--;
          if (depth === 0) {
            const inner = text.slice(contentStart, pos);
            const innerHtml = markdownToHtml(inner);
            const idx = foldableBlocks.length;
            foldableBlocks.push('<details class="foldable"><summary>' + foldLabel + '</summary>' + innerHtml + '</details>');
            foldResult += ' ' + idx + ' ';
            segStart = pos + 2;
          }
        }
        pos++;
        continue;
      }
    }
    foldFlush(text.length);
    const textWithoutFoldables = foldResult;

    const lines = textWithoutFoldables.split("\n");
    const out = [];
    let inCode = false;
    let codeLang = "plain";
    let codeBuffer = [];
    let inUl = false;
    let inOl = false;

    const parseTableRow = (row) => {
      const trimmed = row.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
      const inner = trimmed.slice(1, -1);
      const cells = [];
      let current = "";
      let inCode = false;
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === "`") {
          inCode = !inCode;
          current += ch;
        } else if (ch === "|" && !inCode) {
          cells.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      cells.push(current);
      return cells;
    };

    const wrapCodeLines = (codeHtml) => {
      const lines = codeHtml.split("\n");
      if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
      return lines.map((line) => `<span class="code-line">${line || " "}</span>`).join("\n");
    };

    const closeLists = () => {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const safe = escapeHtml(line);
      const fenceMatch = line.match(/^```(.*)$/);

      if (fenceMatch) {
        closeLists();
        if (!inCode) {
          inCode = true;
          codeLang = normalizeCodeLang(fenceMatch[1]);
          codeBuffer = [];
        } else {
          const highlighted = highlightCode(codeBuffer.join("\n"), codeLang);
          out.push(`<pre class="code-block" data-lang="${codeLang}"><code class="language-${codeLang}">${wrapCodeLines(highlighted)}</code></pre>`);
          inCode = false;
          codeLang = "plain";
          codeBuffer = [];
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      const mathDelim =
        line.match(/^\s*\$\$(.*)$/) || line.match(/^\s*\\\[(.*)$/);
      if (mathDelim) {
        closeLists();
        const isBracketStyle = line.trimStart().startsWith("\\[");
        const endPattern = isBracketStyle ? /(.*)\\\]\s*$/ : /(.*)\$\$\s*$/;
        const first = mathDelim[1] || "";
        const mathLines = [];
        let closed = false;

        if (first && endPattern.test(first)) {
          const match = first.match(endPattern);
          mathLines.push((match && match[1]) || "");
          closed = true;
        } else if (first) {
          mathLines.push(first);
        }

        if (!closed) {
          while (i + 1 < lines.length) {
            i += 1;
            const current = lines[i];
            const endMatch = current.match(endPattern);
            if (endMatch) {
              if (endMatch[1]) {
                mathLines.push(endMatch[1]);
              }
              closed = true;
              break;
            }
            mathLines.push(current);
          }
        }

        out.push(createMathPlaceholder(mathLines.join("\n"), true));
        continue;
      }

      if (line.trim() === "") {
        closeLists();
        continue;
      }

      if (/^(\s*)([-*_])(?:\s*\2){2,}\s*$/.test(line)) {
        closeLists();
        out.push("<hr />");
        continue;
      }

      if (/^#{1,4}\s/.test(line)) {
        closeLists();
        const m = safe.match(/^(#{1,4})\s(.+)$/);
        if (m) {
          const level = m[1].length;
          out.push(`<h${level}>${inlineMarkdown(m[2])}</h${level}>`);
        }
        continue;
      }

      if (/^>\s?/.test(line)) {
        closeLists();
        const quoteLines = [];
        while (i < lines.length) {
          const current = lines[i];
          if (/^>\s?/.test(current)) {
            quoteLines.push(current.replace(/^>\s?/, ""));
            i += 1;
            continue;
          }
          if (current.trim() === "" && /^>\s?/.test(lines[i + 1] || "")) {
            quoteLines.push("");
            i += 1;
            continue;
          }
          break;
        }
        i -= 1;
        out.push(`<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>`);
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        if (!inOl) {
          closeLists();
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${inlineMarkdown(safe.replace(/^\d+\.\s+/, ""))}</li>`);
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        if (!inUl) {
          closeLists();
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${inlineMarkdown(safe.replace(/^[-*]\s+/, ""))}</li>`);
        continue;
      }

      if (/^\|.+\|$/.test(line)) {
        closeLists();
        const tableRows = [];
        while (i < lines.length) {
          const cur = lines[i];
          if (!/^\|.+\|$/.test(cur)) break;
          tableRows.push(cur);
          i += 1;
        }
        i -= 1;

        if (tableRows.length >= 2 && /^[\s:|,-]+$/.test(tableRows[1].replace(/\|/g, ""))) {
          const headerCells = parseTableRow(tableRows[0]);
          const alignRow = tableRows[1];
          const aligns = parseTableRow(alignRow).map((cell) => {
            const t = cell.trim();
            if (/^:-+:$/.test(t)) return '"center"';
            if (/^:-+$/.test(t)) return '"left"';
            if (/^-+:$/.test(t)) return '"right"';
            return '""';
          });

          out.push("<table>");
          out.push("<thead><tr>");
          headerCells.forEach((cell, idx) => {
            const a = aligns[idx] || '""';
            out.push(`<th align=${a}>${inlineMarkdown(escapeHtml(cell.trim()))}</th>`);
          });
          out.push("</tr></thead>");
          out.push("<tbody>");
          for (let r = 2; r < tableRows.length; r += 1) {
            const cells = parseTableRow(tableRows[r]);
            out.push("<tr>");
            cells.forEach((cell, idx) => {
              const a = aligns[idx] || '""';
              out.push(`<td align=${a}>${inlineMarkdown(escapeHtml(cell.trim()))}</td>`);
            });
            out.push("</tr>");
          }
          out.push("</tbody></table>");
        } else {
          // Not a valid table — render each row as a paragraph
          tableRows.forEach((row) => {
            out.push(`<p>${inlineMarkdown(escapeHtml(row))}</p>`);
          });
        }
        continue;
      }

      closeLists();
      out.push(`<p>${inlineMarkdown(safe)}</p>`);
    }

    if (inCode) {
      const highlighted = highlightCode(codeBuffer.join("\n"), codeLang);
      out.push(`<pre class="code-block" data-lang="${codeLang}"><code class="language-${codeLang}">${wrapCodeLines(highlighted)}</code></pre>`);
    }
    closeLists();
    var result = out.join("\n");
    // Restore foldable blocks
    if (foldableBlocks.length) {
      result = result.replace(/ (\d+) /g, function (_m, idx) {
        return foldableBlocks[parseInt(idx, 10)] || '';
      });
    }
    return result;
  }
  window.Markdown = {
    toHtml: markdownToHtml,
    inline: inlineMarkdown,
  };
})();
