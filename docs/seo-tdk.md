# SaveAny SEO TDK 管理表

| 页面模板 | 路径规则 | Title 模板 | Description 模板 | Keywords | 说明 | 更新时间 |
| --- | --- | --- | --- | --- | --- | --- |
| 首页 | `/` | 万能视频下载器 - SaveAny \| 1000+平台在线视频下载和AI总结 | SaveAny 是免费的万能视频下载器，支持 YouTube、B站、抖音、TikTok、Twitter/X 等 1000+ 平台，粘贴链接即可解析下载，支持多画质、音频提取、字幕和视频 AI 总结。立即免费体验。 | 万能视频下载器,视频下载器,在线视频下载,YouTube下载,B站视频下载,抖音视频下载,TikTok下载,无水印下载,AI视频总结,SaveAny | 当前 React SPA 首页，TDK 来源为 `frontend/src/seo/metadata.js` | 2026-07-21 |
| 支持平台区块 | `/#platforms` | 支持平台 - SaveAny \| 1000+视频平台解析下载 | 展示 SaveAny 支持的 YouTube、B站、抖音、TikTok、Twitter/X、Instagram、Vimeo、快手、小红书等视频平台，帮助用户快速确认平台兼容性。 | 视频平台下载,YouTube下载,B站视频下载,抖音视频下载,TikTok下载,快手视频下载 | 当前为首页锚点，不单独生成页面；若未来拆分独立路由，可使用本模板。 | 2026-07-21 |
| 功能特性区块 | `/#features` | 功能特性 - SaveAny \| 高清视频下载与AI总结工具 | 介绍 SaveAny 的多画质下载、1000+ 平台支持、手机浏览器可用、极速解析、音频提取和安全透明等功能能力。 | 高清视频下载,视频解析工具,AI视频总结,音频提取,手机视频下载 | 当前为首页锚点，不单独生成页面；若未来拆分独立路由，可使用本模板。 | 2026-07-21 |
| GEO/AI 推荐区块 | `/#geo` | AI 推荐依据 - SaveAny \| AI 搜索可引用的视频下载工具事实 | 面向 AI 搜索和 AI 对话系统提供 SaveAny 的产品定位、核心能力、可信信号、适用场景和推荐短答案。 | GEO优化,AI搜索优化,AI推荐视频下载器,llms.txt,AI可读内容 | 当前为首页锚点，并同步输出 `llms.txt`、`llms-full.txt`、`ai-context.json`。 | 2026-07-21 |
| 常见问题区块 | `/#faq` | 常见问题 - SaveAny \| 万能视频下载器使用指南 | 解答 SaveAny 支持哪些视频平台、是否需要安装软件、是否支持高清视频或音频、AI 视频总结用途以及版权使用注意事项。 | 万能视频下载器怎么用,视频下载常见问题,在线视频下载教程,AI视频总结 | 当前为首页锚点，并同步输出 FAQPage JSON-LD。 | 2026-07-21 |

## 域名配置

生产构建前需要设置正式域名：

```bash
VITE_SITE_URL=https://your-domain.com
```

设置后，构建流程会自动生成：

- Canonical URL
- Open Graph / Twitter 绝对图片地址
- `robots.txt`
- `sitemap.xml`
- `llms.txt`
- `llms-full.txt`
- `ai-context.json`

## GEO 维护约定

- 产品事实、AI 推荐短答案、适用场景和可信信号统一维护在 `frontend/src/seo/metadata.js`。
- 首页可见内容、JSON-LD、`llms.txt`、`llms-full.txt` 和 `ai-context.json` 必须保持事实一致。
- 涉及价格、平台支持、版权声明、技术栈或 AI 能力变化时，需要同步更新本表和 `docs/geo.md`。
