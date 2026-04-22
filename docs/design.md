# SaveAny 万能视频下载器 - 方案设计文档

## 一、技术架构

```
┌─────────────────────────────────┐
│         用户浏览器 (PC/手机)       │
└──────────┬──────────────────────┘
           │ HTTP
           ▼
┌─────────────────────────────────┐
│   Frontend (React + Vite)        │
│   - TailwindCSS 样式             │
│   - Lucide Icons 图标            │
│   - SSE 进度监听                 │
│   - 端口: 3000                   │
│   - Vite Proxy → Backend         │
└──────────┬──────────────────────┘
           │ /api/* 代理
           ▼
┌─────────────────────────────────┐
│   Backend (Python FastAPI)       │
│   - RESTful API                  │
│   - SSE 进度推送                 │
│   - 端口: 8000                   │
│   - 内存任务管理                 │
│   - 临时文件存储                 │
│   - 封面图片代理                 │
└──────────┬──────────────────────┘
           │ 智能路由
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐ ┌──────────────────┐
│ 抖音专用  │ │   yt-dlp 通用     │
│ 解析器    │ │   下载引擎        │
│ (httpx)  │ │   1000+ 平台      │
│ 无需Cookie│ │   格式/清晰度选择 │
│ HTML解析  │ │   音视频合并      │
│ 直链下载  │ │   进度回调        │
└──────────┘ └──────────────────┘
```

## 二、技术选型

### 2.1 前端

| 技术         | 版本 | 用途     |
| ------------ | ---- | -------- |
| React        | 18.x | UI 框架  |
| Vite         | 5.x  | 构建工具 |
| TailwindCSS  | 3.x  | 样式框架 |
| Lucide React | 最新 | 图标库   |

**选型理由**:

- React 生态成熟，组件化开发高效
- Vite 开发体验好，HMR 快
- TailwindCSS 原子化 CSS，快速还原设计稿
- 参考网站也使用 Tailwind 体系

### 2.2 后端

| 技术    | 版本    | 用途         |
| ------- | ------- | ------------ |
| Python  | 3.9+    | 运行时       |
| FastAPI | 0.115.x | Web 框架     |
| uvicorn | 0.30.x  | ASGI 服务器  |
| yt-dlp  | 2024.x  | 视频下载引擎 |

**选型理由**:

- yt-dlp 是 Python 库，原生调用最简单
- FastAPI 轻量、自带 API 文档、支持异步
- 无数据库，任务存内存，文件临时存储

### 2.3 为什么用 yt-dlp

- GitHub 180k+ Star，社区活跃
- 支持 1000+ 视频平台
- 可作为 Python 库内嵌调用（`from yt_dlp import YoutubeDL`）
- `extract_info()` 获取元数据，`download()` 执行下载
- 自带格式选择、音视频合并、进度回调

## 三、API 设计

### 3.1 视频解析

```
POST /api/parse
Body: { "url": "https://www.youtube.com/watch?v=xxx" }
Response: {
  "title": "视频标题",
  "thumbnail": "封面URL",
  "duration": 120,
  "uploader": "上传者",
  "view_count": 10000,
  "extractor": "youtube",
  "quality_options": [
    { "label": "最佳画质 (自动)", "format_id": "best", ... },
    { "label": "1080p (mp4)", "format_id": "137", ... },
    ...
  ]
}
```

### 3.2 发起下载

```
POST /api/download
Body: { "url": "...", "format_id": "best" }
Response: { "task_id": "abc12345" }
```

### 3.3 下载进度 (SSE)

```
GET /api/progress/{task_id}
Response: SSE stream
  data: { "status": "downloading", "progress": 45.2 }
  data: { "status": "done", "progress": 100 }
```

### 3.4 获取文件

```
GET /api/file/{task_id}
Response: 文件流 (application/octet-stream)
```

## 四、页面结构设计

### 4.1 首页（单页应用）

```
┌──────────────────────────────────┐
│  Header: Logo + Nav + 开通会员    │
├──────────────────────────────────┤
│  Hero 区域:                       │
│  - 支持1000+平台 Badge            │
│  - "万能视频下载器" 大标题          │
│  - 副标题描述                     │
│  - URL 输入框 + 解析按钮          │
│  - 快捷试用按钮                   │
├──────────────────────────────────┤
│  视频结果卡片 (解析后出现):        │
│  - 封面 + 标题 + 元信息           │
│  - 格式选择下拉框                 │
│  - 下载按钮 + 进度条              │
├──────────────────────────────────┤
│  平台展示区:                      │
│  - 12个主流平台图标网格           │
├──────────────────────────────────┤
│  功能特性区:                      │
│  - 6个特性卡片 (2x3 网格)         │
├──────────────────────────────────┤
│  定价区:                          │
│  - 3列定价卡片 (免费/专业/年度)    │
│  - 中间卡片突出显示               │
├──────────────────────────────────┤
│  Footer: 版权信息 + 链接          │
└──────────────────────────────────┘
```

### 4.2 配色方案

| 用途     | 颜色                     | 说明             |
| -------- | ------------------------ | ---------------- |
| 页面背景 | `#0F0B1E` → `#1A1145`    | 深色渐变，高级感 |
| 主强调色 | `#7C3AED` → `#3B82F6`    | 紫蓝渐变，科技感 |
| 金色点缀 | `#F59E0B`                | VIP/付费相关     |
| 文字白色 | `#FFFFFF`                | 标题/重要文字    |
| 文字灰色 | `#9CA3AF`                | 次要文字         |
| 卡片背景 | `rgba(255,255,255,0.05)` | 玻璃拟态         |
| 卡片边框 | `rgba(255,255,255,0.1)`  | 微妙分隔         |

## 五、项目结构

```
video-downloader/
├── docs/                    # 文档
│   ├── requirements.md      # 需求分析
│   └── design.md            # 方案设计
├── frontend/                # 前端
│   ├── src/
│   │   ├── main.jsx         # 入口
│   │   ├── App.jsx          # 主组件
│   │   ├── index.css         # 全局样式
│   │   └── components/
│   │       ├── Header.jsx    # 顶部导航
│   │       ├── Hero.jsx      # Hero区 + 搜索框
│   │       ├── VideoResult.jsx # 视频结果卡片
│   │       ├── AISummary.jsx  # AI总结主容器(Tab切换)
│   │       ├── SummaryTab.jsx # AI摘要展示
│   │       ├── OutlineTab.jsx # 章节大纲展示
│   │       ├── TranscriptTab.jsx # 转录文本展示
│   │       ├── MindMapTab.jsx # 思维导图(markmap)
│   │       ├── AIChatTab.jsx  # AI对话界面
│   │       ├── markdownStyles.js # Markdown渲染样式
│   │       ├── Platforms.jsx  # 支持平台展示
│   │       ├── Features.jsx   # 功能特性
│   │       ├── Pricing.jsx    # 定价方案
│   │       └── Footer.jsx     # 页脚
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js        # Vite配置(含API代理)
│   ├── tailwind.config.js    # TailwindCSS配置
│   └── postcss.config.js
├── backend/                  # 后端
│   ├── main.py               # FastAPI 应用
│   ├── ai_routes.py          # AI功能路由(字幕/总结/对话)
│   ├── ai_service.py         # DeepSeek API封装
│   ├── subtitle_extractor.py # 字幕提取模块
│   ├── douyin_parser.py      # 抖音专用解析器
│   ├── setup_env.py          # 环境初始化+启动
│   ├── .env                  # 环境变量(API Key)
│   ├── requirements.txt      # Python 依赖
│   └── downloads/            # 临时下载目录
├── start.bat                 # Windows 一键启动
└── README.md                 # 项目说明
```

## 六、后续扩展计划

### Phase 2 - 增值功能

- [ ] 批量下载（多 URL 队列）
- [ ] 音频提取（MP3 格式）
- [ ] 字幕下载

### Phase 3 - 商业化

- [ ] 用户注册/登录系统
- [ ] 付费系统集成（微信/支付宝）
- [ ] 下载次数/画质限制
- [ ] 下载历史记录

### Phase 4 - AI 增值（已实现）

- [x] 视频字幕提取（平台字幕 + 自动生成字幕）
- [x] 视频 AI 摘要总结（DeepSeek LLM）
- [x] 章节大纲生成（按时间线分段）
- [x] 思维导图可视化（markmap）
- [x] AI 对话（基于视频内容多轮聊天）
- [x] 转录文本展示（带时间戳）
- [ ] 字幕自动翻译
- [ ] 智能推荐画质
- [ ] Whisper 语音转文字（无字幕视频兜底）

### Phase 5 - 基础设施

- [ ] 数据库集成（用户数据持久化）
- [ ] Redis 缓存（热门视频缓存）
- [ ] 部署方案（Docker + Nginx）
- [ ] CDN 加速
