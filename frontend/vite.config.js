import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { buildAiContext, buildLlmsFullTxt, buildLlmsTxt, buildStructuredData, SEO_META } from './src/seo/metadata.js'

const normalizeSiteUrl = (value) => {
  if (!value) return ''
  return value.trim().replace(/\/+$/, '')
}

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const buildSeoHead = (siteUrl) => {
  const pageUrl = siteUrl ? `${siteUrl}/` : ''
  const imageUrl = siteUrl ? `${siteUrl}${SEO_META.ogImage}` : ''
  const jsonLd = JSON.stringify(buildStructuredData(siteUrl))

  return [
    '<meta http-equiv="X-UA-Compatible" content="IE=edge" />',
    '<meta name="description" content="' + escapeHtml(SEO_META.description) + '" />',
    '<meta name="keywords" content="' + escapeHtml(SEO_META.keywords.join(',')) + '" />',
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    '<meta name="ai-content-declaration" content="public, indexable, citation-friendly" />',
    '<meta name="format-detection" content="telephone=no" />',
    '<meta name="theme-color" content="#0F0B1E" />',
    '<meta name="color-scheme" content="dark" />',
    '<meta name="referrer" content="strict-origin-when-cross-origin" />',
    pageUrl ? '<link rel="canonical" href="' + escapeHtml(pageUrl) + '" />' : '',
    '<meta property="og:title" content="' + escapeHtml(SEO_META.ogTitle) + '" />',
    '<meta property="og:description" content="' + escapeHtml(SEO_META.ogDescription) + '" />',
    '<meta property="og:type" content="website" />',
    pageUrl ? '<meta property="og:url" content="' + escapeHtml(pageUrl) + '" />' : '',
    imageUrl ? '<meta property="og:image" content="' + escapeHtml(imageUrl) + '" />' : '',
    imageUrl ? '<meta property="og:image:width" content="1200" />' : '',
    imageUrl ? '<meta property="og:image:height" content="630" />' : '',
    '<meta property="og:locale" content="' + escapeHtml(SEO_META.locale) + '" />',
    '<meta property="og:site_name" content="' + escapeHtml(SEO_META.siteName) + '" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:title" content="' + escapeHtml(SEO_META.ogTitle) + '" />',
    '<meta name="twitter:description" content="' + escapeHtml(SEO_META.ogDescription) + '" />',
    imageUrl ? '<meta name="twitter:image" content="' + escapeHtml(imageUrl) + '" />' : '',
    '<meta itemprop="name" content="' + escapeHtml(SEO_META.ogTitle) + '" />',
    '<meta itemprop="description" content="' + escapeHtml(SEO_META.ogDescription) + '" />',
    imageUrl ? '<meta itemprop="image" content="' + escapeHtml(imageUrl) + '" />' : '',
    '<script type="application/ld+json">' + jsonLd.replace(/</g, '\\u003c') + '</script>',
  ]
    .filter(Boolean)
    .join('\n    ')
}

const buildRobotsTxt = (siteUrl) => {
  const contextLines = siteUrl
    ? [
        `# AI-readable product context: ${siteUrl}/llms.txt`,
        `# Full AI-readable context: ${siteUrl}/llms-full.txt`,
        `# Machine-readable context: ${siteUrl}/ai-context.json`,
      ]
    : ['# Set VITE_SITE_URL to emit absolute AI context links.']

  const sitemapLine = siteUrl
    ? `Sitemap: ${siteUrl}/sitemap.xml`
    : '# Set VITE_SITE_URL to emit a Sitemap directive.'

  return [
    'User-agent: *',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: Claude-SearchBot',
    'Allow: /',
    '',
    'User-agent: Claude-User',
    'Allow: /',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    ...contextLines,
    '',
    sitemapLine,
    '',
  ].join('\n')
}

const buildSitemapXml = (siteUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

const saveAnySeoPlugin = (siteUrl) => {
  let isSsrBuild = false

  return {
    name: 'saveany-seo',
    configResolved(config) {
      isSsrBuild = Boolean(config.build.ssr)
    },
    transformIndexHtml(html) {
      return html.replace('<!-- SAVEANY_SEO_META -->', buildSeoHead(siteUrl))
    },
    generateBundle() {
      if (isSsrBuild) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: buildRobotsTxt(siteUrl),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'llms.txt',
        source: buildLlmsTxt(siteUrl),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'llms-full.txt',
        source: buildLlmsFullTxt(siteUrl),
      })

      this.emitFile({
        type: 'asset',
        fileName: 'ai-context.json',
        source: JSON.stringify(buildAiContext(siteUrl), null, 2),
      })

      if (siteUrl) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: buildSitemapXml(siteUrl),
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL || env.SITE_URL)

  return {
    plugins: [react(), saveAnySeoPlugin(siteUrl)],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
