# SaveAny - 万能视频下载器

支持 1000+ 视频平台的在线视频下载工具，集成 AI 智能视频分析，包含抖音专用无水印下载。

## 功能特性

### 视频下载

- **1000+ 平台支持** — 基于 yt-dlp，覆盖 YouTube、Bilibili、Twitter/X 等主流平台
- **抖音无水印下载** — 专用解析模块，无需登录/Cookie，直接获取无水印视频
- **多画质选择** — 自动识别可用清晰度，支持最佳画质、指定分辨率、仅音频
- **实时进度** — SSE 推送下载进度，前端实时展示进度条

### AI 智能分析

- **字幕提取** — 自动提取平台字幕（B站 CC 字幕、YouTube 字幕等）
- **AI 视频摘要** — DeepSeek 大模型流式生成视频摘要
- **章节大纲** — 按视频内容逻辑自动拆分章节
- **思维导图** — markmap 可视化渲染视频知识结构
- **转录文本** — 带时间戳的字幕段落展示
- **AI 对话** — 基于视频内容的多轮智能问答

## 技术架构

```
用户浏览器 → Frontend (React + Vite + TailwindCSS, :3000)
                │ /api/* 代理
                ▼
            Backend (Python FastAPI, :8000)
                │
          ┌─────┼──────────┐
          ▼     ▼          ▼
       yt-dlp  抖音解析器  AI 服务
       通用引擎 (httpx)    (DeepSeek)
       1000+平台           字幕提取 + 流式总结 + 对话
```

## 快速启动

### 方式一：一键启动（Windows）

```bash
start.bat
```

### 方式二：手动启动

```bash
# 1. 安装后端依赖
cd backend
pip install -r requirements.txt

# 2. 安装前端依赖
cd ../frontend
npm install

# 3. 启动后端 (端口 8000)
cd ../backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 4. 新终端，启动前端 (端口 3000)
cd frontend
npm run dev
```

访问 http://localhost:3000

## 技术栈

| 层级     | 技术                     | 说明                 |
| -------- | ------------------------ | -------------------- |
| 前端     | React 18 + Vite 5        | SPA 框架             |
| 样式     | TailwindCSS 3            | 原子化 CSS           |
| 图标     | Lucide React             | SVG 图标库           |
| Markdown | react-markdown           | AI 输出渲染          |
| 思维导图 | markmap                  | Markdown → 脑图      |
| 后端     | Python FastAPI           | 异步 Web API         |
| 下载引擎 | yt-dlp                   | 1000+ 平台支持       |
| 抖音引擎 | httpx + iesdouyin API    | 无 Cookie 无水印下载 |
| AI LLM   | DeepSeek Chat            | 摘要/对话生成        |
| 字幕提取 | B站 dm/view API + yt-dlp | 多平台字幕获取       |
| 进度推送 | SSE (Server-Sent Events) | 实时进度/流式输出    |

## API 接口

| 接口                      | 方法      | 说明                         |
| ------------------------- | --------- | ---------------------------- |
| `/api/health`             | GET       | 健康检查                     |
| `/api/parse`              | POST      | 解析视频 URL（自动识别平台） |
| `/api/download`           | POST      | 发起下载任务                 |
| `/api/progress/{task_id}` | GET (SSE) | 实时下载进度                 |
| `/api/file/{task_id}`     | GET       | 获取已下载文件               |
| `/api/thumbnail?url=`     | GET       | 封面图片代理                 |
| `/api/test?url=`          | GET       | 诊断测试接口                 |
| `/api/subtitle`           | POST      | 字幕/转录提取                |
| `/api/summarize`          | POST(SSE) | AI 视频摘要（流式）          |
| `/api/chat`               | POST(SSE) | AI 视频对话（流式）          |

## 抖音下载原理

基于 [rathodpratham-dev/douyin_video_downloader](https://github.com/rathodpratham-dev/douyin_video_downloader)（MIT 协议）的方案：

1. **短链解析** — `v.douyin.com/xxx` → 302 重定向 → 获取真实 URL
2. **提取 video_id** — 从 URL 路径/查询参数中提取
3. **公开 API** — `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids={id}`
4. **去水印** — 将 `playwm` 替换为 `play` 即得无水印视频地址
5. **Fallback** — API 失败时解析分享页 `window._ROUTER_DATA`，含 WAF 挑战自动破解

## 项目结构

```
video-downloader/
├── backend/
│   ├── main.py               # FastAPI 主应用（视频解析/下载路由）
│   ├── ai_routes.py          # AI 功能路由（字幕/总结/对话）
│   ├── ai_service.py         # DeepSeek API 封装（流式输出）
│   ├── subtitle_extractor.py # 字幕提取（B站 API + yt-dlp）
│   ├── douyin_parser.py      # 抖音专用解析器
│   ├── .env                  # 环境变量（DEEPSEEK_API_KEY）
│   ├── requirements.txt      # Python 依赖
│   └── downloads/            # 临时下载文件目录
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # 根组件
│   │   ├── main.jsx          # 入口文件
│   │   ├── index.css         # 全局样式
│   │   └── components/
│   │       ├── Header.jsx    # 导航栏
│   │       ├── Hero.jsx      # 首页搜索区
│   │       ├── VideoResult.jsx   # 视频信息 + 下载
│   │       ├── AISummary.jsx     # AI 总结主面板
│   │       ├── SummaryTab.jsx    # 摘要 Tab
│   │       ├── OutlineTab.jsx    # 大纲 Tab
│   │       ├── TranscriptTab.jsx # 转录 Tab
│   │       ├── MindMapTab.jsx    # 思维导图 Tab
│   │       ├── AIChatTab.jsx     # AI 对话 Tab
│   │       ├── markdownStyles.jsx # Markdown 渲染样式
│   │       ├── Platforms.jsx     # 支持平台展示
│   │       ├── Features.jsx      # 功能特性
│   │       ├── Pricing.jsx       # 定价方案
│   │       └── Footer.jsx        # 页脚
│   ├── index.html
│   ├── vite.config.js        # Vite 配置（含 API 代理）
│   ├── tailwind.config.js    # Tailwind 主题扩展
│   └── package.json
├── docs/
│   ├── requirements.md       # 需求文档
│   ├── design.md             # 技术设计文档
│   └── summary.md            # 项目总结文档
├── start.bat                 # Windows 一键启动
├── .gitignore
└── README.md

## 已验证平台

| 平台 | 下载 | 字幕提取 | 备注 |
|------|------|---------|------|
| Bilibili | ✅ | ✅ | dm/view API 提取 CC/AI 字幕 |
| 抖音 | ✅ | — | 无水印下载，无需登录 |
| YouTube | ✅ | ✅ | yt-dlp 字幕提取 |

## 环境要求

- **Python** ≥ 3.9
- **Node.js** ≥ 16
- **FFmpeg**（音视频合并需要）
- **DeepSeek API Key**（AI 功能，配置在 `backend/.env`）

## 后续规划

- [x] AI 视频摘要（DeepSeek LLM 流式生成）
- [x] 字幕提取（B站 + YouTube + 通用平台）
- [x] AI 对话（基于视频内容多轮问答）
- [x] 思维导图可视化
- [ ] Whisper 语音转文字（无字幕视频兜底）
- [ ] 字幕自动翻译
- [ ] 批量下载（多 URL 队列）
- [ ] 用户账户系统
- [ ] 支付集成（会员订阅）
- [ ] Docker 部署方案

## 许可

抖音解析模块参考 [douyin_video_downloader](https://github.com/rathodpratham-dev/douyin_video_downloader)（MIT License）。
```
