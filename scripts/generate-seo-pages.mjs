import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteOrigin = "https://fire.heojay.dev";
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(rootDir, "dist");
const sourceHtmlPath = join(distDir, "index.html");
const seoPagesPath = join(rootDir, "src", "seoPages.json");
const guideListPath = "/guides/";
const guideListTitle = "경제적 자립 계산 가이드 | FIRE 계산기";
const guideListDescription =
  "4% 룰, 경제적 자립, 은퇴자금 계산 방법 등 FIRE 계산기를 이해하는 데 필요한 가이드를 모아 봅니다.";

const [sourceHtml, seoPagesJson] = await Promise.all([
  readFile(sourceHtmlPath, "utf8"),
  readFile(seoPagesPath, "utf8"),
]);
const seoPages = JSON.parse(seoPagesJson);

await Promise.all([
  writeGuideListPage(sourceHtml, seoPages),
  ...seoPages.map((page) => writeGuidePage(page, sourceHtml)),
]);
await writeSitemap(seoPages);

async function writeGuideListPage(html, seoPages) {
  const canonicalUrl = `${siteOrigin}${guideListPath}`;
  const guideListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#guides`,
    name: guideListTitle,
    description: guideListDescription,
    url: canonicalUrl,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: seoPages.map((page, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteOrigin}${page.path}`,
        name: page.h1,
      })),
    },
  };

  const guideListHtml = html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(guideListTitle)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/s,
      `<meta name="description" content="${escapeHtml(guideListDescription)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/s,
      `<link rel="canonical" href="${canonicalUrl}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:url" content="${canonicalUrl}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:title" content="${escapeHtml(guideListTitle)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:description" content="${escapeHtml(guideListDescription)}" />`,
    )
    .replace(
      /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/s,
      '<meta property="og:image:alt" content="경제적 자립 계산 가이드" />',
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/s,
      `<meta name="twitter:title" content="${escapeHtml(guideListTitle)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/s,
      `<meta name="twitter:description" content="${escapeHtml(guideListDescription)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/>/s,
      '<meta name="twitter:image:alt" content="경제적 자립 계산 가이드" />',
    )
    .replace(
      /<script id="page-json-ld" type="application\/ld\+json">.*?<\/script>/s,
      `<script id="page-json-ld" type="application/ld+json">${JSON.stringify(
        guideListJsonLd,
      )}</script>`,
    );

  const outputPath = join(distDir, guideListPath, "index.html");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, guideListHtml);
}

async function writeGuidePage(page, html) {
  const canonicalUrl = `${siteOrigin}${page.path}`;
  const guideJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonicalUrl}#faq`,
    name: page.title,
    description: page.description,
    url: canonicalUrl,
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const guideHtml = html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/s,
      `<meta name="description" content="${escapeHtml(page.description)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/s,
      `<link rel="canonical" href="${canonicalUrl}" />`,
    )
    .replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/s,
      '<meta property="og:type" content="article" />',
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:url" content="${canonicalUrl}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    )
    .replace(
      /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/s,
      `<meta property="og:image:alt" content="${escapeHtml(page.h1)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/s,
      `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/s,
      `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/>/s,
      `<meta name="twitter:image:alt" content="${escapeHtml(page.h1)}" />`,
    )
    .replace(
      /<script id="page-json-ld" type="application\/ld\+json">.*?<\/script>/s,
      `<script id="page-json-ld" type="application/ld+json">${JSON.stringify(
        guideJsonLd,
      )}</script>`,
    );

  const outputPath = join(distDir, page.path, "index.html");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, guideHtml);
}

async function writeSitemap(seoPages) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${siteOrigin}/`, priority: "1.0" },
    { loc: `${siteOrigin}${guideListPath}`, priority: "0.9" },
    ...seoPages.map((page) => ({
      loc: `${siteOrigin}${page.path}`,
      priority: "0.8",
    })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  await writeFile(join(distDir, "sitemap.xml"), sitemap);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
