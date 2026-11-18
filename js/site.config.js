window.SITE_CONFIG = {
  name: "ninouiu",
  home: "./index.html",
  logo: {
    src: "https://cdn.jsdelivr.net/gh/Xn0O/nnoo@main/assets/site/logo.webp",
    alt: "ninouiu"
  },
  nav: [
    { label: "Home", href: "./index.html" },
    { label: "Dev", href: "./dev.html" },
    { label: "Blog", href: "./blog.html" }
  ],
  // 页脚：copyright 支持 {year} / {author}，year: "auto" 自动使用当前年份
  footer: {
    copyright: "© {year} {author}",
    author: "NINO",
    year: "auto",
    // 起始年份：显示成 2023-<当前年>
    since: 2023
  },
  // 首页个人简介：头像、简介和链接都在 data/profile.json 中修改
  profile: {
    data: "./data/profile.json"
  },
  // 首页画廊：图片列表在 data/gallery.json 中修改
  gallery: {
    data: "./data/gallery.json"
  },
  // Dev 页：分类和内容在 data/dev.json 中修改
  dev: {
    data: "./data/dev.json"
  },
  // Blog：文章列表在 data/blog.json 中修改
  blog: {
    data: "./data/blog.json"
  }
};
