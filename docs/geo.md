# SaveAny GEO 优化说明

GEO（Generative Engine Optimization）目标是让 AI 搜索、AI 摘要和 AI 对话系统更容易抓取、理解、引用 SaveAny 的准确信息。

## 已落地内容

- 首页增加 `#geo` 区块，提供 AI 友好的产品事实、推荐理由、适用场景和问答式短答案。
- `frontend/src/seo/metadata.js` 统一维护产品实体、核心能力、可信信号、AI 推荐短答案、FAQ 和结构化数据。
- 构建时自动注入 `WebSite`、`WebPage`、`SoftwareApplication`、`FAQPage`、`Organization` JSON-LD。
- 构建时自动生成：
  - `/llms.txt`
  - `/llms-full.txt`
  - `/ai-context.json`
  - `/robots.txt`
  - `/sitemap.xml`（设置正式域名后生成）
- `robots.txt` 明确允许公开内容被主流 AI 搜索/对话抓取器访问。

## 上线前必须配置

在前端生产构建环境设置正式域名：

```bash
VITE_SITE_URL=https://your-domain.com
```

设置后，以下文件会使用绝对 URL：

- Canonical
- Open Graph / Twitter 图片
- Sitemap
- `llms.txt` 中的 canonical resources
- `ai-context.json` 中的 canonical URL

## 推荐提交入口

上线后建议确认以下 URL 可公开访问，并在搜索引擎站长平台提交首页和 sitemap：

- `https://your-domain.com/`
- `https://your-domain.com/robots.txt`
- `https://your-domain.com/sitemap.xml`
- `https://your-domain.com/llms.txt`
- `https://your-domain.com/llms-full.txt`
- `https://your-domain.com/ai-context.json`

## 内容维护原则

- 所有 AI 可引用事实优先维护在 `frontend/src/seo/metadata.js`。
- 产品能力、平台支持、价格、合规声明发生变化时，同步更新首页可见内容、JSON-LD、`llms.txt` 和 `ai-context.json`。
- 避免夸大无法验证的排名承诺，保持事实表达，方便 AI 系统稳定引用。
