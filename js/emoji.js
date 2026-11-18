(function () {
  const script =
    document.currentScript ||
    document.querySelector('script[src$="js/emoji.js"]') ||
    document.querySelector('script[src$="/emoji.js"]');

  const DATA_URL = script
    ? new URL("../data/emoji.json", script.src).href
    : new URL("./data/emoji.json", document.baseURI).href;
  const SITE_BASE = new URL("../", DATA_URL);
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT"]);

  const emojiMap = new Map();
  let ready = false;

  function addEntry(item) {
    if (!item || typeof item !== "object") return;
    const name = String(item.name || "").trim().toLowerCase();
    const src = String(item.src || "").trim();
    if (!name || !src) return;
    const entry = {
      name,
      src,
      alt: String(item.alt || name).trim(),
    };
    emojiMap.set(name, entry);
    (Array.isArray(item.aliases) ? item.aliases : []).forEach((alias) => {
      const key = String(alias || "").trim().toLowerCase();
      if (key) emojiMap.set(key, entry);
    });
  }

  function makeEmoji(entry, shortcode) {
    const img = document.createElement("img");
    img.className = "emoji";
    img.src = new URL(entry.src.replace(/^\.\//, ""), SITE_BASE).href;
    img.alt = entry.alt;
    img.title = ":" + shortcode + ":";
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    return img;
  }

  function processTextNode(node) {
    if (!ready || !node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentNode;
    if (!parent || SKIP.has(parent.nodeName)) return;

    const text = node.nodeValue || "";
    if (text.indexOf(":") === -1) return;

    const re = /:([a-z0-9_-]+):/gi;
    let match;
    let lastIndex = 0;
    let fragment = null;

    while ((match = re.exec(text)) !== null) {
      const key = match[1].toLowerCase();
      const entry = emojiMap.get(key);
      if (!entry) continue;

      if (!fragment) fragment = document.createDocumentFragment();
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      fragment.appendChild(makeEmoji(entry, key));
      lastIndex = re.lastIndex;
    }

    if (!fragment) return;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    parent.replaceChild(fragment, node);
  }

  function processRoot(root) {
    if (!ready || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP.has(root.nodeName)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf(":") === -1) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.parentNode && SKIP.has(node.parentNode.nodeName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  function observe(root) {
    processRoot(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            processTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            processRoot(node);
          }
        });
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  fetch(DATA_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("无法读取 emoji 数据");
      return response.json();
    })
    .then((payload) => {
      const items = Array.isArray(payload.items) ? payload.items : [];
      items.forEach(addEntry);
      ready = true;
      observe(document.querySelector(".user_page") || document.body);
    })
    .catch((error) => {
      console.error("emoji:", error);
    });
})();
