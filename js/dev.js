(function () {
  const config = window.SITE_CONFIG || {};
  const devConfig = config.dev || {};
  const DEV_DATA = devConfig.data || "./data/dev.json";
  const POSITIONS = ["left", "right", "top", "bottom"];

  const filtersEl = document.querySelector("#dev-filters");
  const entriesEl = document.querySelector("#entries");

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function normalizeItem(item) {
    if (!item || typeof item !== "object") return null;

    const title = String(item.title || "").trim();
    const date = String(item.date || "").trim();
    const dateLabel = String(item.dateLabel || date).trim();
    const body = String(item.body || "").trim();
    const image = String(item.image || item.src || "").trim();
    const imageAlt = String(item.imageAlt || title || "Log image").trim();
    const rawPosition = String(item.imagePosition || item.position || "").trim().toLowerCase();
    const imagePosition = POSITIONS.indexOf(rawPosition) !== -1 ? rawPosition : "left";
    const imageCaption = String(item.imageCaption || item.caption || "").trim();
    const rawTags = Array.isArray(item.tags) ? item.tags : item.tag ? [item.tag] : [];
    const tags = rawTags
      .map((tag) => String(tag == null ? "" : tag).trim())
      .filter(Boolean);

    if (!title && !body && !image) return null;

    return { title, date, dateLabel, body, image, imageAlt, imagePosition, imageCaption, tags };
  }

  function normalizeTags(payload, items) {
    const provided = Array.isArray(payload.tags) ? payload.tags : [];
    const seen = new Set();
    const tags = [];

    const add = (id, label) => {
      const key = String(id == null ? "" : id).trim();
      if (!key || key === "all" || seen.has(key)) return;
      seen.add(key);
      tags.push({ id: key, label: String(label == null ? "" : label).trim() || key });
    };

    provided.forEach((tag) => {
      if (typeof tag === "string") {
        add(tag, tag);
      } else if (tag && typeof tag === "object") {
        add(tag.id || tag.tag, tag.label || tag.name || tag.id || tag.tag);
      }
    });

    if (!tags.length) {
      items.forEach((item) => item.tags.forEach((id) => add(id, id)));
    }

    return tags;
  }

  function toParagraphs(text) {
    return String(text || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  let items = [];
  let tags = [];
  let tagLabels = new Map();
  let allLabel = "All";
  let activeTag = "all";
  let introText = "";
  let pageSize = 5;
  let visibleCount = 5;
  let moreLabel = "加载更多";
  let moreBtn = null;

  function createEntry(item) {
    const article = createEl("article", "dev_entry");
    article.dataset.imagePos = item.imagePosition || "left";

    const hasMeta = Boolean(item.date || item.tags.length);
    const hasBodyText = Boolean(item.title || item.body);

    if (!hasBodyText) article.classList.add("no_text");

    if (hasMeta) {
      const meta = createEl("p", "dev_meta");
      if (item.date) {
        const time = document.createElement("time");
        time.dateTime = item.date;
        time.textContent = item.dateLabel || item.date;
        meta.appendChild(time);
      }
      item.tags.forEach((id) => {
        meta.appendChild(createEl("span", "dev_tag", tagLabels.get(id) || id));
      });
      article.appendChild(meta);
    }

    if (item.image) {
      const media = createEl("figure", "dev_media");
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.imageAlt;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("load", () => {
        if (img.naturalHeight > img.naturalWidth) {
          article.classList.add("is-portrait");
        }
      });
      media.appendChild(img);
      if (item.imageCaption) {
        media.appendChild(createEl("figcaption", "dev_caption", item.imageCaption));
      }
      article.appendChild(media);
    } else {
      article.classList.add("no_media");
    }

    if (hasBodyText) {
      const body = createEl("div", "dev_body");

      if (item.title) {
        body.appendChild(createEl("h3", "dev_title", item.title));
      }

      if (item.body) {
        const text = createEl("div", "dev_text");
        toParagraphs(item.body).forEach((line) => {
          text.appendChild(createEl("p", "", line));
        });
        body.appendChild(text);
      }

      article.appendChild(body);
    }

    return article;
  }

  function updateFilterButtons() {
    if (!filtersEl) return;
    filtersEl.querySelectorAll(".dev_filter").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tag === activeTag));
    });
  }

  function currentItems() {
    return items.filter(
      (item) => activeTag === "all" || item.tags.indexOf(activeTag) !== -1
    );
  }

  function updateMoreButton(shownCount, total) {
    if (!moreBtn) return;
    if (shownCount >= total) {
      moreBtn.hidden = true;
      return;
    }
    moreBtn.hidden = false;
    const rest = total - shownCount;
    moreBtn.textContent = `${moreLabel}（剩余 ${rest}）`;
  }

  // intro 放在分类标签上方
  function renderIntroBlock() {
    if (!introText) return;
    const anchor = filtersEl || entriesEl;
    if (!anchor || !anchor.parentNode) return;
    // 预渲染过的页面里已经有这一块，先清掉避免出现两行
    anchor.parentNode.querySelectorAll(".page_intro_group").forEach((node) => node.remove());
    const wrap = document.createElement("div");
    wrap.className = "page_intro_group";
    introText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const intro = createEl("p", "page_intro");
        intro.appendChild(createEl("span", "page_intro_block", line));
        wrap.appendChild(intro);
      });
    anchor.parentNode.insertBefore(wrap, anchor);
  }

  function renderEntries() {
    if (!entriesEl) return;
    entriesEl.textContent = "";

    const visible = currentItems();

    if (!visible.length) {
      const empty = createEl("p", "empty", items.length ? "这一部分还没有日志。" : "暂无日志。");
      entriesEl.appendChild(empty);
      updateMoreButton(0, 0);
      return;
    }

    const shown = visible.slice(0, visibleCount);
    shown.forEach((item) => {
      entriesEl.appendChild(createEntry(item));
    });

    updateMoreButton(shown.length, visible.length);
  }

  function loadMore() {
    if (!entriesEl) return;
    const visible = currentItems();
    const start = visibleCount;
    visibleCount = Math.min(visibleCount + pageSize, visible.length);

    visible.slice(start, visibleCount).forEach((item) => {
      entriesEl.appendChild(createEntry(item));
    });

    updateMoreButton(Math.min(visibleCount, visible.length), visible.length);
  }

  function createMoreButton() {
    if (!entriesEl || !entriesEl.parentNode) return;
    // 预渲染的按钮没有事件绑定，先移除再重建
    entriesEl.parentNode.querySelectorAll(".dev_more").forEach((node) => node.remove());
    moreBtn = createEl("button", "dev_more");
    moreBtn.type = "button";
    moreBtn.hidden = true;
    moreBtn.addEventListener("click", loadMore);
    entriesEl.parentNode.insertBefore(moreBtn, entriesEl.nextSibling);
  }

  function renderFilters() {
    if (!filtersEl) return;

    filtersEl.textContent = "";
    if (!tags.length) {
      filtersEl.hidden = true;
      return;
    }

    filtersEl.hidden = false;
    const filters = [{ id: "all", label: allLabel }].concat(tags);

    filters.forEach((tag) => {
      const button = createEl("button", "dev_filter", tag.label);
      button.type = "button";
      button.dataset.tag = tag.id;
      button.setAttribute("aria-pressed", String(tag.id === activeTag));
      button.addEventListener("click", () => {
        if (activeTag === tag.id) return;
        activeTag = tag.id;
        visibleCount = pageSize;
        updateFilterButtons();
        renderEntries();
      });
      filtersEl.appendChild(button);
    });
  }

  async function init() {
    if (!entriesEl) return;

    let payload;
    try {
      const url = new URL(DEV_DATA, document.baseURI);
      url.searchParams.set("_v", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("无法加载 dev.json");
      payload = await res.json();
    } catch (error) {
      console.error(error);
      entriesEl.appendChild(createEl("p", "empty", "无法加载日志。"));
      return;
    }

    const data = payload && typeof payload === "object" ? payload : {};
    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray(data.items)
        ? data.items
        : [];

    items = raw
      .map(normalizeItem)
      .filter(Boolean)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    allLabel = String(data.allLabel || "All").trim() || "All";
    introText = String(data.intro || "").trim();
    moreLabel = String(data.moreLabel || "").trim() || "加载更多";
    const rawPageSize = Math.floor(Number(data.perPage));
    if (Number.isFinite(rawPageSize) && rawPageSize > 0) pageSize = rawPageSize;
    visibleCount = pageSize;
    tags = normalizeTags(data, items);
    tagLabels = new Map(tags.map((tag) => [tag.id, tag.label]));

    renderIntroBlock();
    createMoreButton();
    renderFilters();
    renderEntries();
  }

  init();
})();
