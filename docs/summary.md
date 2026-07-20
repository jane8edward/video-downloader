# SaveAny 万能视频下载器 - 项目总结文档

## 一、项目概述

SaveAny 是一个基于 Web 的万能视频下载工具，支持 1000+ 视频平台的在线视频解析与下载，同时集成了 AI 智能分析能力。项目采用前后端分离架构，前端 React + Vite，后端 Python FastAPI，核心下载引擎基于 yt-dlp。

### 已完成功能

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 视频解析与下载 | ✅ 已完成 | 支持 1000+ 平台，多画质选择，实时进度 |
| 抖音无水印下载 | ✅ 已完成 | 专用解析器，无需 Cookie/登录 |
| AI 视频摘要 | ✅ 已完成 | DeepSeek LLM 流式生成 |
| 章节大纲 | ✅ 已完成 | 按视频内容逻辑拆分章节 |
| 思维导图 | ✅ 已完成 | markmap 可视化渲染 |
| 转录文本 | ✅ 已完成 | 带时间戳的字幕段落展示 |
| AI 对话 | ✅ 已完成 | 基于视频内容的多轮问答 |
| B站字幕提取 | ✅ 已完成 | dm/view API 直接提取 CC/AI 字幕 |
| 解析与总结同屏 | ✅ 已完成 | 左侧视频下载、右侧 AI 总结，解析后自动总结 |
| 转录/脑图导出 | ✅ 已完成 | 转录支持 SRT/TXT，脑图支持 PNG/SVG 与全屏 |

---

## 二、技术架构

```
┌─────────────────────────────────┐
│       用户浏览器 (PC/手机)       │
└──────────┬──────────────────────┘
           │ HTTP
           ▼
┌─────────────────────────────────┐
│  Frontend (React + Vite, :3000)  │
│  TailwindCSS · Lucide · markmap │
│  SSE 流式渲染 · 深色主题 UI      │
└──────────┬──────────────────────┘
           │ /api/* Vite Proxy
           ▼
┌─────────────────────────────────┐
│  Backend (Python FastAPI, :8000) │
│  RESTful API · SSE 进度推送      │
│  内存任务管理 · 临时文件存储      │
└──────────┬──────────────────────┘
           │
     ┌─────┼──────────┐
     ▼     ▼          ▼
  yt-dlp  抖音解析器   AI 服务
  通用引擎 (httpx)    (DeepSeek)
  1000+平台           字幕提取
  格式选择            流式总结
  进度回调            多轮对话
```

### 核心技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.x | SPA 组件化 |
| 构建工具 | Vite | 5.x | HMR 开发、打包 |
| 样式 | TailwindCSS | 3.x | 原子化 CSS |
| 图标 | Lucide React | 最新 | SVG 图标 |
| Markdown 渲染 | react-markdown | 最新 | AI 输出渲染 |
| 思维导图 | markmap | 最新 | Markdown → 脑图 |
| 后端框架 | FastAPI | 0.115.x | 异步 Web API |
| ASGI 服务器 | uvicorn | 0.30.x | 生产级服务 |
| 下载引擎 | yt-dlp | ≥2024.8.6 | 1000+ 平台 |
| HTTP 客户端 | httpx | 0.27.x | B站 API / 抖音解析 |
| AI LLM | DeepSeek Chat | deepseek-chat | 摘要/对话 |
| AI SDK | OpenAI Python | ≥1.0 | API 调用封装 |

---

## 三、核心模块详解

### 3.1 字幕提取模块 (`subtitle_extractor.py`)

字幕提取是 AI 功能的基础，负责从视频中获取文本内容。

**提取策略（按优先级）**：

1. **B站视频** → 优先使用 dm/view API 直接提取
   - `x/web-interface/view?bvid=...` → 获取 aid + cid
   - `x/v2/dm/view?aid=...&oid=...&type=1` → 获取字幕列表
   - 下载字幕 JSON → 解析 body 段落
   - 无需 WBI 签名，无需 Cookie
2. **通用平台** → yt-dlp 字幕提取
   - `writesubtitles` + `writeautomaticsub` 同时开启
   - 人工字幕优先于自动字幕
   - 过滤弹幕（danmaku、live_danmaku）

**语言优先级**：`zh-Hans` > `zh` > `zh-CN` > `en` > `ja` > `ko`

**支持的字幕格式解析**：
- Bilibili JSON（`body[].content`）
- YouTube json3（`events[].segs[].utf8`）
- WebVTT（时间戳 + 文本块）
- SRT（序号 + 时间戳 + 文本）

**B站字幕提取的技术选型历程**：

| 方案 | 结果 | 原因 |
|------|------|------|
| yt-dlp 内置提取 | ❌ 失败 | yt-dlp 调用 `x/player/wbi/v2` 缺少 WBI 签名 |
| 自实现 WBI 签名 + `x/player/wbi/v2` | ⚠️ 复杂且不稳定 | 需要动态获取密钥、MD5 签名 |
| `x/v2/dm/view` API | ✅ 成功 | 无需签名、简单可靠 |

### 3.2 AI 服务模块 (`ai_service.py`)

基于 DeepSeek Chat API 提供 AI 能力：

- **视频摘要生成**：接收字幕文本，SSE 流式输出 `===SUMMARY===`、`===OUTLINE===`、`===MINDMAP===` 三段内容
- **AI 对话**：基于视频字幕 + 摘要上下文的多轮对话，流式输出
- 使用 OpenAI 兼容 SDK（`AsyncOpenAI`），异步流式调用

### 3.3 AI 路由模块 (`ai_routes.py`)

三个 API 端点：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/subtitle` | POST | 字幕提取 |
| `/api/summarize` | POST → SSE | AI 视频总结（流式） |
| `/api/chat` | POST → SSE | AI 多轮对话（流式） |

### 3.4 前端 AI 组件

| 组件 | 功能 |
|------|------|
| `AISummary.jsx` | AI 面板主容器，Tab 切换，字幕提取 + 摘要生成编排 |
| `SummaryTab.jsx` | 摘要展示（Markdown 渲染 + 打字机光标） |
| `OutlineTab.jsx` | 章节大纲展示 |
| `TranscriptTab.jsx` | 转录文本展示（时间戳 + 文本段），支持 SRT/TXT 下载 |
| `MindMapTab.jsx` | 思维导图可视化（markmap 渲染），支持全屏与 PNG/SVG 导出 |
| `AIChatTab.jsx` | AI 对话界面（SSE 流式 + 智能滚动） |

### 3.5 同屏解析与 AI 总结体验

解析成功后，前端不再把视频下载与 AI 总结拆成上下两个板块，而是在结果区使用桌面端双栏布局：

- **左栏下载卡片**：展示封面、标题、作者、时长、播放量、平台标识；画质选择改为常驻列表，下载按钮固定在列表下方。
- **右栏 AI 面板**：自动触发“字幕提取 → AI 总结”，摘要、大纲、转录、思维导图、AI 对话在同一面板内切换。
- **固定高度策略**：桌面端结果区固定高度，左右卡片等高；摘要、转录、大纲等长内容只在右侧内容区内部滚动，避免生成过程中撑开页面并遮挡下方内容。
- **Markdown 兼容处理**：前端会清洗 LLM 输出中的 `##SUMMARY`、无空格标题等异常格式，保证 `react-markdown` 正确渲染标题、列表、加粗和引用。

---

## 四、API 接口总览

### 视频下载相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/parse` | POST | 解析视频 URL |
| `/api/download` | POST | 发起下载任务 |
| `/api/progress/{task_id}` | GET (SSE) | 实时下载进度 |
| `/api/file/{task_id}` | GET | 获取已下载文件 |
| `/api/thumbnail?url=` | GET | 封面图片代理 |

### AI 功能相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/subtitle` | POST | 字幕/转录提取 |
| `/api/summarize` | POST → SSE | AI 视频摘要（流式） |
| `/api/chat` | POST → SSE | AI 视频对话（流式） |

---

## 五、项目文件结构

```
video-downloader/
├── docs/
│   ├── requirements.md        # 需求分析文档
│   ├── design.md              # 技术方案设计文档
│   └── summary.md             # 项目总结文档（本文档）
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # 应用入口
│   │   ├── App.jsx            # 根组件（路由 + 状态管理）
│   │   ├── index.css          # 全局样式 + 动画
│   │   └── components/
│   │       ├── Header.jsx     # 导航栏
│   │       ├── Hero.jsx       # 首页搜索区
│   │       ├── VideoResult.jsx # 视频信息 + 下载操作
│   │       ├── AISummary.jsx  # AI 总结主面板
│   │       ├── SummaryTab.jsx # 摘要 Tab
│   │       ├── OutlineTab.jsx # 大纲 Tab
│   │       ├── TranscriptTab.jsx # 转录 Tab
│   │       ├── MindMapTab.jsx # 思维导图 Tab
│   │       ├── AIChatTab.jsx  # AI 对话 Tab
│   │       ├── markdownStyles.jsx # Markdown 渲染样式
│   │       ├── Platforms.jsx  # 支持平台展示
│   │       ├── Features.jsx   # 功能特性展示
│   │       ├── Pricing.jsx    # 定价方案
│   │       └── Footer.jsx     # 页脚
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js         # Vite 配置（含 API 代理）
│   ├── tailwind.config.js     # Tailwind 主题扩展
│   └── postcss.config.js
├── backend/
│   ├── main.py                # FastAPI 主应用（视频解析/下载路由）
│   ├── ai_routes.py           # AI 功能路由（字幕/总结/对话）
│   ├── ai_service.py          # DeepSeek API 封装（流式输出）
│   ├── subtitle_extractor.py  # 字幕提取模块（B站 API + yt-dlp）
│   ├── douyin_parser.py       # 抖音专用解析器
│   ├── setup_env.py           # 环境初始化脚本
│   ├── .env                   # 环境变量（DEEPSEEK_API_KEY）
│   ├── requirements.txt       # Python 依赖
│   └── downloads/             # 临时下载目录（gitignore）
├── start.bat                  # Windows 一键启动
├── .gitignore
└── README.md
```

---

## 六、开发过程中的关键问题与解决方案

### 问题 1：B站字幕提取失败

**现象**：B站视频明确有 CC 字幕（UP主上传），但 yt-dlp 返回"无字幕"。

**根因分析**：
- yt-dlp 内部调用 `x/player/wbi/v2` 获取字幕信息
- 该 API 要求 WBI 签名（动态密钥 + MD5），yt-dlp 未正确实现
- API 返回 403 或空数据

**解决方案**：
- 参考成功项目，改用 `x/v2/dm/view` API
- 该 API 无需 WBI 签名，直接通过 `aid` + `cid` 获取字幕列表
- 作为 B站的首选提取方式，yt-dlp 作为兜底

### 问题 2：422 Unprocessable Entity

**现象**：字幕提取成功后，调 `/api/summarize` 返回 422，前端显示 `[object Object]`。

**根因分析**：
- `duration` 字段定义为 `int`，yt-dlp 返回 `float`（如 `211.5`）
- FastAPI 422 的 `detail` 是数组，前端直接传给 `Error()` 序列化为 `[object Object]`

**解决方案**：
- 后端 `duration` 类型改为 `Optional[float]`
- 前端发送时 `Math.round()` 兜底
- 前端正确解析数组格式的 422 错误

### 问题 3：AI 对话页面强制滚动

**现象**：SSE 流式输出期间，`scrollIntoView()` 不断将整个页面滚动到底部，用户无法向上查看。

**根因分析**：
- `scrollIntoView()` 会滚动整个页面视口，而非仅聊天容器
- 每个 token 触发 `setMessages` → `useEffect` → `scrollIntoView`

**解决方案**：
- 改用 `container.scrollTop = container.scrollHeight` 只滚动聊天容器
- 增加用户滚动检测：用户手动上滚时暂停自动滚动
- 发送新消息时重置滚动状态

### 问题 4：自动总结后摘要 Tab 为空

**现象**：用户粘贴视频链接并点击解析后，右侧 AI 面板先显示“正在总结”，随后摘要 Tab 变为空状态；但大纲、转录等 Tab 已有内容。自动模式下原本的“AI 智能总结”触发按钮被隐藏，用户无法手动补救。

**根因分析**：
- 前端最初只按严格的 `===SUMMARY===`、`===OUTLINE===`、`===MINDMAP===` 分隔符解析 LLM 输出。
- DeepSeek 有时会输出带空格的分隔符（如 `=== SUMMARY ===`）、Markdown 标题式分隔符（如 `## SUMMARY`），或中文分段标题。
- 当摘要分隔符未被识别时，`summaryContent` 保持为空；而字幕提取、转录展示和其他段落仍可能正常，所以出现“只有摘要空”的状态断层。

**解决方案**：
- 在 `AISummary.jsx` 中增加按行解析器，兼容英文/中文、等号式/标题式分段标记。
- 保留正则解析作为补充，兼容 `=== SUMMARY ===` 等带空格变体。
- 总结流结束后执行最终兜底：若摘要仍为空，从完整响应中截取大纲/思维导图之前的内容作为摘要。
- 在 `SummaryTab.jsx` 的空摘要状态中展示明确说明和“重新生成总结”按钮，避免用户被卡在无操作入口的状态。

---

## 七、环境要求

- **Python** ≥ 3.9
- **Node.js** ≥ 16
- **FFmpeg**（yt-dlp 音视频合并需要）
- **DeepSeek API Key**（AI 功能需要，配置在 `backend/.env`）

---

## 八、后续规划

### 待开发功能

- [ ] Whisper 语音转文字（无字幕视频兜底）
- [ ] 字幕自动翻译
- [ ] 批量下载（多 URL 队列）
- [ ] 音频提取（MP3 格式）
- [ ] 用户注册/登录系统
- [ ] 付费系统集成
- [ ] Docker 部署方案
- [ ] CDN 加速

### 可优化项

- [ ] 字幕提取结果缓存（避免重复请求 B站 API）
- [ ] AI 摘要结果缓存（相同视频不重复调用 LLM）
- [ ] 前端错误边界组件（更优雅的异常处理）
- [ ] 移动端适配优化
