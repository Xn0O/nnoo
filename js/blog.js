(function () {
  const config = window.SITE_CONFIG || {};
  const BLOG_DATA = (config.blog && config.blog.data) || "./data/blog.json";
  const listEl = document.querySelector("#blog-list");
  let introText = "";
  let pageSize = 5;
  let renderedCount = 0;
  let entriesCache = [];
  let lastYear = "";
  let moreLabel = "加载更多";
  let moreBtn = null;
  const postEl = document.querySelector("#blog-post");

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function paragraphs(value) {
    return String(value == null ? "" : value)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function normalize(item) {
    if (!item || typeof item !== "object") return null;
    const title = text(item.title);
    const body = text(item.body);
    if (!title && !body) return null;
    return {
      id: text(item.id).replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
      title,
      date: text(item.date),
      dateLabel: text(item.dateLabel) || text(item.date),
      excerpt: text(item.excerpt),
      cover: text(item.cover),
      hideCover: ["1", "true", "yes", "on"].includes(text(item.hideCover).toLowerCase()),
      series: text(item.series),

      body,
    };
  }

  // 没有显式封面时，用正文里的第一张图当卡片封面
  function coverOf(item) {
    if (item.hideCover) return "";
    if (item.cover) return item.cover;
    if (item.bodyHtml) {
      const match = /<img[^>]+src="([^"]+)"/i.exec(item.bodyHtml);
      if (match) return match[1];
    }
    if (item.body) {
      const match = /!\[[^\]]*\]\(([^)\s]+)/.exec(item.body);
      if (match) return match[1];
    }
    return "";
  }

  function buildCard(item, options) {
    const card = document.createElement("a");
    card.className = "blog_card";
    card.href = item.id ? `./blog/${item.id}.html` : "#";
    card.setAttribute("aria-label", `打开文章：${item.title || item.id}`);

    const coverSrc = options && options.cover === false ? "" : coverOf(item);

    if (coverSrc) {
      card.classList.add("has-cover");
      const cover = document.createElement("img");
      cover.className = "blog_cover";
      cover.src = coverSrc;
      cover.alt = item.title ? item.title + " 封面" : "";
      cover.loading = "lazy";
      cover.decoding = "async";

      const overlay = createEl("div", "blog_overlay");
      if (item.dateLabel) overlay.appendChild(createEl("p", "blog_date", item.dateLabel));
      overlay.appendChild(createEl("h3", "blog_title", item.title || item.id));
      card.append(cover, overlay);
      return card;
    }

    const body = createEl("div", "blog_card_body");
    if (item.dateLabel) body.appendChild(createEl("p", "blog_date", item.dateLabel));
    body.appendChild(createEl("h3", "blog_title", item.title || item.id));
    if (item.excerpt) body.appendChild(createEl("p", "blog_excerpt", item.excerpt));
    card.appendChild(body);
    return card;
  }

  function buildGroupCard(group) {
    const wrap = createEl("section", "blog_group");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blog_card blog_group_head";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", `展开合集：${group.series}`);

    // 合集头只显示名称和篇数，不显示封面（封面留给组内各篇）
    const body = createEl("div", "blog_card_body");
    body.appendChild(createEl("p", "blog_date", `合集 · ${group.items.length} 篇`));
    body.appendChild(createEl("h3", "blog_title", group.series));
    button.appendChild(body);

    const arrow = createEl("span", "blog_group_arrow", "▾");
    button.appendChild(arrow);

    // 合集默认展开，点击可收起
    const list = createEl("div", "blog_group_items");
    list.hidden = false;
    wrap.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", `收起合集：${group.series}`);
    group.items.forEach((item) => list.appendChild(buildCard(item, { cover: false })));

    button.addEventListener("click", () => {
      const open = list.hidden;
      list.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", `${open ? "收起" : "展开"}合集：${group.series}`);
      wrap.classList.toggle("is-open", open);
    });

    wrap.append(button, list);
    return wrap;
  }

  function buildEntries(items) {
    const groups = new Map();
    const entries = [];

    items.forEach((item) => {
      if (!item.series) {
        entries.push({ type: "post", item });
        return;
      }
      if (!groups.has(item.series)) {
        const group = { type: "group", series: item.series, items: [] };
        groups.set(item.series, group);
        entries.push(group);
      }
      groups.get(item.series).items.push(item);
    });

    return entries;
  }

  function buildYear(year) {
    const heading = createEl("h2", "blog_year");
    heading.appendChild(createEl("span", "", year));
    return heading;
  }

  function yearOf(entry) {
    const date = entry.type === "group" ? (entry.items[0] && entry.items[0].date) || "" : entry.item.date;
    return String(date).slice(0, 4);
  }

  function appendEntries() {
    const next = Math.min(renderedCount + pageSize, entriesCache.length);
    for (let index = renderedCount; index < next; index += 1) {
      const entry = entriesCache[index];
      const year = yearOf(entry);
      if (year && year !== lastYear) {
        lastYear = year;
        listEl.appendChild(buildYear(year));
      }
      listEl.appendChild(entry.type === "group" ? buildGroupCard(entry) : buildCard(entry.item));
    }
    renderedCount = next;
    updateMore();
  }

  function updateMore() {
    if (!moreBtn) return;
    const rest = entriesCache.length - renderedCount;
    moreBtn.hidden = rest <= 0;
    if (rest <= 0) return;
    moreBtn.textContent = `${moreLabel}（剩余 ${rest}）`;
  }

  function renderList(items) {
    if (!listEl) return;
    listEl.textContent = "";
    if (postEl) postEl.hidden = true;
    listEl.hidden = false;

    entriesCache = buildEntries(items);
    renderedCount = 0;
    lastYear = "";

    if (introText) {
      introText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const intro = createEl("p", "page_intro");
          intro.appendChild(createEl("span", "page_intro_block", line));
          listEl.appendChild(intro);
        });
    }

    if (!entriesCache.length) {
      listEl.appendChild(createEl("p", "empty", "还没有文章。"));
      updateMore();
      return;
    }

    appendEntries();
  }

  function setupMoreButton() {
    if (!listEl || !listEl.parentNode) return;
    // 预渲染的按钮没有事件绑定，先移除再重建
    listEl.parentNode.querySelectorAll(".blog_more").forEach((node) => node.remove());
    moreBtn = createEl("button", "blog_more");
    moreBtn.type = "button";
    moreBtn.hidden = true;
    moreBtn.addEventListener("click", () => {
      appendEntries();
    });
    listEl.parentNode.insertBefore(moreBtn, listEl.nextSibling);
  }

  // 代码块左上角的复制按钮
  function decorateCodeBlocks(root) {
    root.querySelectorAll("pre.code-block").forEach((pre) => {
      if (pre.querySelector(".code-copy-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy-btn";
      btn.textContent = "复制";
      btn.addEventListener("click", async () => {
        const lines = Array.from(pre.querySelectorAll(".code-line"));
        const code = lines.length
          ? lines.map((line) => line.textContent).join("\n")
          : (pre.querySelector("code") || pre).textContent;
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = "已复制";
        } catch (error) {
          btn.textContent = "复制失败";
        }
        window.setTimeout(() => {
          btn.textContent = "复制";
        }, 1200);
      });
      pre.appendChild(btn);
    });
  }

  function renderPost(item) {
    if (!postEl) return;
    if (listEl) listEl.hidden = true;
    postEl.hidden = false;
    postEl.textContent = "";

    if (item.cover && !item.hideCover) {
      const cover = document.createElement("img");
      cover.className = "blog_cover";
      cover.src = item.cover;
      cover.alt = item.title ? item.title + " 封面" : "";
      cover.decoding = "async";
      postEl.appendChild(cover);
    }
    if (item.dateLabel) postEl.appendChild(createEl("p", "blog_date", item.dateLabel));
    postEl.appendChild(createEl("h1", "blog_title", item.title));

    const body = createEl("div", "blog_body");
    if (window.Markdown && typeof window.Markdown.toHtml === "function") {
      body.innerHTML = window.Markdown.toHtml(item.body);
      body.classList.add("markdown-content");
    } else {
      paragraphs(item.body).forEach((line) => body.appendChild(createEl("p", "", line)));
    }
    decorateCodeBlocks(body);
    postEl.appendChild(body);

    if (item.title) {
      document.title = item.title + (config.name ? " — " + config.name : "");
    }
  }

  async function init() {
    if (!listEl && !postEl) return;

    let payload;
    try {
      const url = new URL(BLOG_DATA, document.baseURI);
      url.searchParams.set("_v", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("无法加载 blog.json");
      payload = await res.json();
    } catch (error) {
      console.error(error);
      if (listEl && !listEl.hidden) listEl.appendChild(createEl("p", "empty", "无法加载文章。"));
      return;
    }

    const data = payload && typeof payload === "object" ? payload : {};
    introText = text(data.intro);
    moreLabel = text(data.moreLabel) || "加载更多";
    const rawPageSize = Math.floor(Number(data.perPage));
    if (Number.isFinite(rawPageSize) && rawPageSize > 0) pageSize = rawPageSize;
    const raw = Array.isArray(payload) ? payload : Array.isArray(data.items) ? data.items : [];
    const items = raw
      .map(normalize)
      .filter(Boolean)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const requested =
      (document.body && document.body.dataset.postId) ||
      new URLSearchParams(window.location.search).get("post");
    const post = requested ? items.find((item) => item.id === requested) : null;

    if (post) {
      renderPost(post);
    } else {
      setupMoreButton();
      renderList(items);
    }
  }

  init();
})();
