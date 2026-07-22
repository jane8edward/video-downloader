# SaveAny 万能视频下载器

SaveAny 是一个 Web 版万能视频下载器，核心能力是“粘贴链接 -> 解析视频 -> 选择画质 -> 下载文件”，并集成 AI 视频总结、章节大纲、转录文本、思维导图和视频问答能力。

项目采用前后端分离架构：

- Frontend: React 18 + Vite 5 + TailwindCSS
- Backend: Python FastAPI + yt-dlp + DeepSeek API
- Billing: Stripe Checkout 一次性支付
- Storage: SQLite 本地持久化用户、会员、支付和 AI 免费次数

## 已完成功能

### 视频下载

- 支持 1000+ 视频平台，核心下载能力基于 yt-dlp。
- 支持 YouTube、Bilibili、抖音、TikTok、Twitter/X 等主流平台。
- 抖音提供专用无水印解析逻辑。
- 支持画质选择、封面代理、下载进度 SSE 推送。
- 免费用户不限制下载功能。

### AI 视频分析

- 自动提取视频字幕或转录文本。
- 基于 DeepSeek 流式生成 AI 摘要。
- 生成章节大纲、转录文本、思维导图。
- VIP 用户可使用视频 AI 对话。
- AI 输出经过 Markdown 清洗，避免展示 `===SUMMARY===`、残缺 `**`、异常 `###` 等脏格式。

### 用户与会员

- 支持邮箱注册、登录、退出登录。
- 使用 HttpOnly Cookie 保存登录态。
- 密码使用 PBKDF2 哈希保存。
- Header 显示免费/VIP 铭牌、会员到期时间和退出登录入口。
- VIP 用户隐藏“开通会员”按钮。

### 会员支付

- 使用 Stripe Checkout `payment` 模式，一次性支付，不自动续费。
- 月度会员：CNY 9.90，开通 30 天。
- 年度会员：CNY 68.00，开通 365 天。
- 会员未过期时再次购买，会从当前到期时间继续累加。
- Webhook 校验 Stripe 签名，并按 Stripe event id 幂等处理。
- Checkout Session 支持本地记录和支付成功同步兜底。

### 免费权益

- 免费用户每天可使用 AI 总结 3 次。
- 免费次数只限制 AI 总结，不限制视频下载。
- 点击 AI 总结并真正进入生成阶段时预扣 1 次。
- 字幕提取失败不会扣次数。
- AI 生成失败会回滚本次预扣。
- 同一个视频重复请求不会重复扣次数。

### SEO / GEO

- 构建时生成 TDK、Open Graph、Twitter Card、canonical、JSON-LD。
- 生成 `robots.txt`、`llms.txt`、`llms-full.txt`、`ai-context.json`。
- 支持首页预渲染，提升搜索引擎和 AI 搜索可读性。

## 本地启动

### 1. 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://localhost:3000
```

## 环境变量

在 `backend/.env` 中配置：

```bash
DEEPSEEK_API_KEY=your_deepseek_key

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=http://localhost:3000
```

重要提醒：

- 不要提交 `backend/.env`。
- Stripe Secret Key 只能放后端，不能写进前端。
- `STRIPE_PRICE_MONTHLY` 和 `STRIPE_PRICE_YEARLY` 必须填 Stripe Price ID，不是 Product ID。

## Stripe 本地测试

启动 Stripe CLI：

```bash
stripe login
stripe listen --forward-to localhost:8000/api/billing/webhook
```

复制输出的 webhook secret：

```text
Ready! Your webhook signing secret is whsec_xxx
```

写入 `backend/.env`：

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

测试卡：

```text
4242 4242 4242 4242
```

有效期填任意未来日期，例如 `12/34`；CVC 填任意 3 位数字。

## 常用命令

```bash
# 后端语法检查
python -m py_compile backend/main.py backend/ai_routes.py backend/auth_store.py backend/billing_routes.py

# 前端生产构建
cd frontend
npm run build
```

## 目录结构

```text
video-downloader/
  backend/
    main.py                # 视频解析、下载、进度、文件接口
    ai_routes.py           # 字幕、AI 总结、AI 对话接口
    ai_service.py          # DeepSeek 调用封装
    auth_routes.py         # 注册、登录、退出、当前用户
    auth_store.py          # SQLite 用户、会员、支付、AI 次数存储
    billing_routes.py      # Stripe Checkout 与 Webhook
    douyin_parser.py       # 抖音无水印解析
    subtitle_extractor.py  # 字幕提取
    requirements.txt
  frontend/
    src/
      App.jsx
      auth.jsx
      components/
        AISummary.jsx
        AIChatTab.jsx
        AuthModal.jsx
        CheckoutReturn.jsx
        Header.jsx
        Pricing.jsx
        aiTextSanitizer.js
      seo/
        metadata.js
    package.json
    vite.config.js
  docs/
    design.md
    requirements.md
    stripe-membership.md
    summary.md
```

## 注意事项

- 下载功能应遵守目标平台条款和版权法规，仅下载用户有权保存的内容。
- 生产环境请使用 HTTPS，并将 Cookie `secure` 选项改为 `true`。
- SQLite 适合当前单机 MVP；多人高并发或多实例部署时建议迁移到 PostgreSQL/MySQL。
