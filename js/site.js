(function () {
  const config = window.SITE_CONFIG || {};
  const nav = Array.isArray(config.nav) ? config.nav : [];
  const current = location.pathname.split("/").pop() || "index.html";
  const pageTitle = document.body.dataset.title || "";

  if (config.name) {
    document.title = pageTitle ? pageTitle + " — " + config.name : config.name;
  }

  const header = document.querySelector("header");
  if (header) {
    // 预渲染页面里已有 header/nav/footer，重建前先清空，避免叠加
    header.textContent = "";
    document.querySelectorAll(".site_nav, .site_nav_sentinel, .site_footer").forEach((node) => node.remove());
    const titleRow = document.createElement("div");
    titleRow.className = "inner_column text_header";
    const heading = document.createElement("h1");
    const homeLink = document.createElement("a");
    homeLink.href = config.home || "./index.html";

    const logo =
      typeof config.logo === "string"
        ? { src: config.logo }
        : config.logo && typeof config.logo === "object"
          ? config.logo
          : {};

    if (logo.src) {
      const img = document.createElement("img");
      img.className = "site_logo";
      img.src = logo.src;
      img.alt = logo.alt || config.name || "Home";
      img.decoding = "async";
      img.addEventListener("error", () => {
        img.remove();
        homeLink.textContent = config.name || "";
      });
      homeLink.appendChild(img);
    } else {
      homeLink.textContent = config.name || "";
    }

    heading.appendChild(homeLink);
    titleRow.appendChild(heading);
    header.appendChild(titleRow);

    if (nav.length) {
      const navRow = document.createElement("nav");
      navRow.className = "site_nav";

      if (logo.src) {
        const navLogo = document.createElement("a");
        navLogo.className = "site_nav_logo";
        navLogo.href = config.home || "./index.html";
        navLogo.setAttribute("aria-label", logo.alt || config.name || "Home");
        const navLogoImg = document.createElement("img");
        navLogoImg.src = logo.src;
        navLogoImg.alt = "";
        navLogoImg.decoding = "async";
        navLogoImg.addEventListener("error", () => navLogo.remove());
        navLogo.appendChild(navLogoImg);
        navRow.appendChild(navLogo);
      }

      nav.forEach((item) => {
        const link = document.createElement("a");
        link.href = item.href;
        link.textContent = item.label;
        const linkPage = String(item.href || "").split(/[?#]/)[0].split("/").pop();
        if (linkPage === current) {
          link.className = "active";
        }
        navRow.appendChild(link);
      });

      // 导航放在 header 外、.user_page 内，sticky 才能覆盖整页
      const page = document.querySelector(".user_page");
      if (page && header.parentNode === page) {
        page.insertBefore(navRow, header.nextSibling);
      } else {
        header.appendChild(navRow);
      }

      // 哨兵：离开视口顶部时给导航加吸顶样式
      const sentinel = document.createElement("div");
      sentinel.className = "site_nav_sentinel";
      sentinel.setAttribute("aria-hidden", "true");
      navRow.parentNode.insertBefore(sentinel, navRow);

      if (typeof IntersectionObserver === "function") {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const stuck = !entry.isIntersecting && entry.boundingClientRect.top < 0;
              navRow.classList.toggle("is-stuck", stuck);
            });
          },
          { threshold: 0 }
        );
        observer.observe(sentinel);
      } else {
        const update = () => {
          navRow.classList.toggle("is-stuck", sentinel.getBoundingClientRect().top < 0);
        };
        window.addEventListener("scroll", update, { passive: true });
        update();
      }
    }
  }

  const footerConfig =
    typeof config.footer === "string"
      ? { copyright: config.footer }
      : config.footer && typeof config.footer === "object"
        ? config.footer
        : {};

  if (footerConfig.enabled !== false) {
    const page = document.querySelector(".user_page");
    if (page) {
      const author = String(footerConfig.author || "NINO");
      const currentYear =
        footerConfig.year && footerConfig.year !== "auto"
          ? String(footerConfig.year)
          : String(new Date().getFullYear());
      // 配置了起始年份就显示成 2023-2026 这样的区间
      const since = String(footerConfig.since || "").trim();
      const year = since && since !== currentYear ? `${since}-${currentYear}` : currentYear;
      const template = String(footerConfig.copyright || "© {year} {author}");
      const footer = document.createElement("footer");
      footer.className = "site_footer";
      footer.textContent = template
        .replace(/\{year\}/g, year)
        .replace(/\{author\}/g, author);
      page.appendChild(footer);
    }
  }
})();
