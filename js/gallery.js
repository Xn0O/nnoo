(function () {
  const config = window.SITE_CONFIG || {};
  const galleryConfig = config.gallery || {};
  const GALLERY_DATA = galleryConfig.data || "./data/gallery.json";
  const DEFAULT_ARROW = "https://cdn.jsdelivr.net/gh/Xn0O/nnoo@main/assets/site/gallery-arrow.webp";
  const ANIMATION_MS = 480;

  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function normalizeItem(item) {
    if (typeof item === "string") {
      const src = item.trim();
      if (!src) return null;
      return { src, full: src, title: "", caption: "", alt: "Art image" };
    }

    if (!item || typeof item !== "object") return null;

    const src = String(item.src || item.image || "").trim();
    if (!src) return null;

    const title = String(item.title || "").trim();
    const caption = String(item.caption || item.desc || "").trim();
    const full = String(item.full || item.href || src).trim();
    const alt = String(item.alt || [title, caption].filter(Boolean).join(" ") || "Art image").trim();

    return { src, full, title, caption, alt };
  }

  function normalizeItems(payload) {
    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
        ? payload.items
        : [];
    return raw.map(normalizeItem).filter(Boolean);
  }

  function normalizeArrow(arrow) {
    if (typeof arrow === "string") return arrow.trim();
    if (arrow && typeof arrow === "object") return String(arrow.src || "").trim();
    return "";
  }

  let lightbox = null;
  let lightboxImage = null;
  let lightboxCaption = null;

  function ensureLightbox() {
    if (lightbox) return;

    lightbox = createEl("dialog", "gallery_lightbox");
    lightbox.setAttribute("aria-label", "图片预览");
    lightbox.tabIndex = -1;

    const close = createEl("button", "gallery_lightbox_close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭");
    close.addEventListener("click", () => lightbox.close());

    lightboxImage = document.createElement("img");
    lightboxImage.className = "gallery_lightbox_image";
    lightboxImage.alt = "";

    lightboxCaption = createEl("p", "gallery_lightbox_caption");

    lightbox.appendChild(close);
    lightbox.appendChild(lightboxImage);
    lightbox.appendChild(lightboxCaption);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", () => {
      document.documentElement.classList.remove("gallery_lightbox_open");
      lightboxImage.removeAttribute("src");
    });

    document.body.appendChild(lightbox);
  }

  function openLightbox(item, withCaption) {
    ensureLightbox();
    lightboxImage.src = item.full;
    lightboxImage.alt = item.alt;

    const caption = withCaption ? [item.title, item.caption].filter(Boolean).join(" · ") : "";
    lightboxCaption.textContent = caption;
    lightboxCaption.hidden = !caption;

    document.documentElement.classList.add("gallery_lightbox_open");
    if (!lightbox.open) lightbox.showModal();
    lightbox.focus();
  }

  function createSlide(item, index, withCaption) {
    const figure = createEl("figure", "gallery_item");
    figure.dataset.index = String(index);

    const thumb = createEl("button", "gallery_thumb");
    thumb.type = "button";
    thumb.setAttribute("aria-label", "查看大图：" + (item.title || item.alt));

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.alt;
    img.loading = "lazy";
    img.decoding = "async";

    thumb.appendChild(img);
    figure.appendChild(thumb);

    if (withCaption && (item.title || item.caption)) {
      const caption = createEl("figcaption", "gallery_caption");
      if (item.title) caption.appendChild(createEl("span", "gallery_title", item.title));
      if (item.caption) caption.appendChild(createEl("span", "gallery_note", item.caption));
      figure.appendChild(caption);
    }

    return figure;
  }

  function createArrowButton(direction, src) {
    const button = createEl("button", "gallery_arrow gallery_arrow_" + direction);
    button.type = "button";
    button.setAttribute("aria-label", direction === "prev" ? "上一张" : "下一张");

    const img = document.createElement("img");
    img.className = "gallery_arrow_icon";
    img.src = src;
    img.alt = "";
    img.draggable = false;
    img.setAttribute("aria-hidden", "true");
    img.addEventListener("error", () => {
      img.remove();
      button.textContent = direction === "prev" ? "‹" : "›";
      button.classList.add("gallery_arrow_text");
    });

    button.appendChild(img);
    return button;
  }

  function buildCarousel(mount, data, items) {
    const arrowSrc = normalizeArrow(data.arrow) || DEFAULT_ARROW;
    const showCaptions = data.showCaptions !== false;

    const carousel = createEl("div", "gallery_carousel");
    carousel.setAttribute("aria-roledescription", "carousel");
    carousel.setAttribute("aria-label", "图片轮播");

    const prev = createArrowButton("prev", arrowSrc);
    const next = createArrowButton("next", arrowSrc);
    const viewport = createEl("div", "gallery_viewport");
    const track = createEl("div", "gallery_track");

    viewport.appendChild(track);
    carousel.appendChild(prev);
    carousel.appendChild(viewport);
    carousel.appendChild(next);
    mount.appendChild(carousel);

    viewport.addEventListener("click", (event) => {
      const thumb = event.target.closest(".gallery_thumb");
      if (!thumb) return;
      const slide = thumb.closest(".gallery_item");
      if (!slide) return;
      const index = Number(slide.dataset.index);
      if (Number.isInteger(index) && items[index]) openLightbox(items[index], showCaptions);
    });

    const state = {
      visible: 3,
      step: 0,
      current: 0,
      animating: false,
      wrapTimer: null,
      resizeTimer: null,
    };

    function getVisible() {
      const raw = getComputedStyle(carousel).getPropertyValue("--gallery-visible");
      const value = parseInt(raw, 10);
      return Number.isFinite(value) && value > 0 ? value : 3;
    }

    function measureStep() {
      const first = track.querySelector(".gallery_item");
      if (!first) return 0;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return first.getBoundingClientRect().width + gap;
    }

    function applyTransform(animated) {
      track.classList.toggle("is-jumping", !animated);
      track.style.transform = `translateX(${-((state.visible + state.current) * state.step)}px)`;

      if (!animated) {
        void track.offsetWidth;
        requestAnimationFrame(() => track.classList.remove("is-jumping"));
      }
    }

    function rebuild() {
      clearTimeout(state.wrapTimer);
      state.animating = false;
      state.current = 0;
      state.visible = getVisible();
      track.innerHTML = "";
      track.classList.remove("is-jumping");
      track.style.transform = "";

      if (items.length <= 1 || items.length < state.visible) {
        carousel.classList.add("is-static");
        items.forEach((item, index) => track.appendChild(createSlide(item, index, showCaptions)));
        return;
      }

      carousel.classList.remove("is-static");

      const before = items.slice(items.length - state.visible);
      before.forEach((item, offset) => {
        track.appendChild(createSlide(item, items.length - state.visible + offset, showCaptions));
      });

      items.forEach((item, index) => track.appendChild(createSlide(item, index, showCaptions)));

      const after = items.slice(0, state.visible);
      after.forEach((item, index) => {
        track.appendChild(createSlide(item, index, showCaptions));
      });

      state.step = measureStep();
      applyTransform(false);
    }

    function go(delta) {
      if (state.animating || items.length <= 1 || items.length < state.visible) return;

      state.animating = true;
      state.current += delta;
      applyTransform(true);

      state.wrapTimer = setTimeout(() => {
        if (state.current >= items.length) {
          state.current = 0;
          applyTransform(false);
        } else if (state.current < 0) {
          state.current = items.length - 1;
          applyTransform(false);
        }
        state.animating = false;
      }, ANIMATION_MS + 40);
    }

    prev.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));

    window.addEventListener("resize", () => {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(rebuild, 160);
    });

    rebuild();
  }

  function render(mount, data, items) {
    const heading = data.heading === false ? "" : String(data.heading || "Arts").trim();

    if (heading) {
      const title = createEl("h2", "gallery_heading", heading);
      title.id = "gallery-heading";
      mount.setAttribute("aria-labelledby", title.id);
      mount.appendChild(title);
    }

    buildCarousel(mount, data, items);
  }

  async function init() {
    const mount = document.querySelector("[data-gallery]");
    if (!mount) return;

    let data;
    try {
      const url = new URL(GALLERY_DATA, document.baseURI);
      url.searchParams.set("_v", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("无法加载 gallery.json");
      data = await res.json();
    } catch (error) {
      console.error(error);
      mount.remove();
      return;
    }

    if (!data || typeof data !== "object" || data.enabled === false) {
      mount.remove();
      return;
    }

    const items = normalizeItems(data);
    if (!items.length) {
      mount.remove();
      return;
    }

    mount.classList.add("gallery_section");
    mount.textContent = "";
    render(mount, data, items);
  }

  init();
})();
