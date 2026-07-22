# SaveAny 技术方案

## 架构概览

```text
Browser
  |
  | HTTP / SSE
  v
Frontend: React + Vite + TailwindCSS
  |
  | /api/* proxy
  v
Backend: FastAPI
  |
  |-- yt-dlp: 通用视频解析与下载
  |-- douyin_parser: 抖音无水印解析
  |-- subtitle_extractor: 字幕提取
  |-- DeepSeek API: AI 总结与对话
  |-- SQLite: 用户、会员、支付、AI 次数
  |-- Stripe: Checkout 与 Webhook
```

## 后端设计

### FastAPI 主应用

`backend/main.py` 负责：

- `/api/health` 健康检查。
- `/api/parse` 解析视频信息。
- `/api/download` 创建下载任务。
- `/api/progress/{task_id}` SSE 推送下载进度。
- `/api/file/{task_id}` 返回下载文件。
- 挂载认证、支付、AI 路由。

### 认证

认证由 `auth_routes.py` 和 `auth_store.py` 实现：

- 邮箱唯一注册。
- 密码使用 PBKDF2 + salt 哈希保存。
- 登录后创建随机 session token。
- 浏览器只保存 HttpOnly Cookie。
- `/api/auth/me` 返回用户公开信息、会员状态和 AI 免费次数。

### 会员

会员状态保存在 `memberships` 表：

- `status=active` 且 `current_period_end > now` 视为有效会员。
- 月度计划增加 30 天。
- 年度计划增加 365 天。
- 如果当前仍是会员，则从当前到期时间继续累加。

### Stripe 支付

`billing_routes.py` 提供：

- `GET /api/billing/plans` 获取套餐。
- `POST /api/billing/checkout` 创建 Checkout Session。
- `POST /api/billing/sync-checkout` 支付完成后的兜底同步。
- `POST /api/billing/webhook` 接收 Stripe Webhook。

关键策略：

- 使用 Stripe Checkout `mode="payment"`，一次性支付。
- 使用 Price ID，不在代码中写死价格对象。
- Webhook 校验签名。
- `stripe_events` 表按 event id 去重。
- `checkout_sessions` 表按 Session 去重，避免重复处理。

### AI 免费次数

免费次数由 `ai_usage` 和 `ai_usage_resources` 两张表控制。

流程：

1. 前端先提取字幕。
2. 字幕存在时才调用 `/api/summarize`。
3. 后端在生成流开始前预扣 1 次。
4. 前端收到 `/api/summarize` 响应后立即刷新用户状态，马上展示剩余次数。
5. 如果 AI 生成过程抛错，后端调用 `refund_ai_quota` 回滚本次预扣。
6. 同一视频资源通过 `resource_key` 去重，重复请求不重复扣。
7. 第 4 个不同视频会在后端被 403 拦截。

### AI 输出清洗

LLM 可能不严格遵守输出格式。前端在 `aiTextSanitizer.js` 做渲染前清洗：

- 清理 `===SUMMARY===`、`===OUTLINE===`、`===MINDMAP===`。
- 清理残缺的 `**`、多余 `===`、异常 `###`。
- 清理 Markdown 代码块围栏。
- 兼容中文分段标题。

## 前端设计

### 认证状态

`frontend/src/auth.jsx` 提供全局认证上下文：

- `user`
- `refreshUser`
- `login`
- `register`
- `logout`
- `authModalOpen`

### Header

`Header.jsx` 展示：

- 免费/VIP 铭牌。
- 用户头像。
- 下拉菜单。
- 会员到期时间。
- 退出登录按钮。
- VIP 用户隐藏“开通会员”按钮。

### AI 面板

`AISummary.jsx` 编排 AI 流程：

1. 检查登录状态。
2. 同步最新用户权益。
3. 提取字幕。
4. 调用 `/api/summarize`。
5. 收到响应后立即刷新剩余次数。
6. 读取 SSE 流，拆分摘要、大纲、思维导图。
7. 渲染 Summary、Outline、Transcript、Mindmap、AI Chat 五个 Tab。

### 会员套餐

`Pricing.jsx` 展示三列套餐：

- 免费版：下载免费，每日 3 次 AI 总结。
- 月度会员：9.90 元，30 天。
- 年度会员：68 元，365 天。

套餐卡片支持 hover 高亮：鼠标移入任意卡片时当前卡片高亮；鼠标移出后默认高亮中间卡片。

## 环境变量

后端 `.env`：

```bash
DEEPSEEK_API_KEY=your_deepseek_key
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=http://localhost:3000
```

前端生产构建可选：

```bash
VITE_SITE_URL=https://your-domain.com
```

## 生产注意事项

- Secret Key 不得进入 Git。
- 数据库、下载目录、构建产物不得提交。
- 使用 HTTPS。
- Cookie `secure` 应在生产环境设置为 `true`。
- 多实例部署时不能继续依赖本地 SQLite，需要迁移到中心化数据库。
- Stripe Webhook 的正式环境 secret 与测试环境 secret 必须分开。
