# SaveAny 项目总结

## 项目定位

SaveAny 是一个“视频下载 + AI 理解”的在线工具。用户粘贴公开视频链接后，可以解析视频信息、选择画质并下载；同时，系统会基于字幕生成 AI 摘要、章节大纲、转录文本、思维导图，并为 VIP 用户提供视频 AI 对话。

## 当前业务规则

### 下载权益

- 下载功能永久免费。
- 免费用户、VIP 用户都可以使用视频解析和下载。
- 当前不对下载次数、画质、平台做会员限制。

### AI 权益

- 未登录用户不能使用 AI 总结。
- 免费登录用户每天可使用 AI 总结 3 次。
- VIP 用户 AI 总结不限次数。
- AI 对话仅 VIP 用户可用。
- 免费次数按本地日期统计。
- 同一用户、同一天、同一视频资源重复请求不会重复扣次数。
- 字幕提取失败不扣次数。
- AI 生成开始时预扣次数；生成失败会回滚；重试成功再扣。

### 会员套餐

- 月度会员：人民币 9.90 元，30 天有效期。
- 年度会员：人民币 68.00 元，365 天有效期。
- 支付为 Stripe 一次性付款，不是订阅，不自动续费。
- 会员未过期时再次购买，会从当前到期时间继续累加。

## 核心模块

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 视频解析/下载 | `backend/main.py` | URL 解析、任务创建、SSE 下载进度、文件返回 |
| 抖音解析 | `backend/douyin_parser.py` | 抖音短链解析和无水印地址获取 |
| 字幕提取 | `backend/subtitle_extractor.py` | B 站字幕 API 与 yt-dlp 字幕兜底 |
| AI 服务 | `backend/ai_service.py` | DeepSeek Chat 流式调用 |
| AI 路由 | `backend/ai_routes.py` | 字幕、总结、对话接口与权限判断 |
| 用户认证 | `backend/auth_routes.py` | 注册、登录、退出、当前用户 |
| 本地存储 | `backend/auth_store.py` | SQLite 表结构和业务读写 |
| 支付 | `backend/billing_routes.py` | Stripe Checkout、同步、Webhook |
| 认证上下文 | `frontend/src/auth.jsx` | 前端用户状态与认证 API |
| AI 面板 | `frontend/src/components/AISummary.jsx` | 字幕提取、总结流读取、Tab 状态 |
| Markdown 清洗 | `frontend/src/components/aiTextSanitizer.js` | 清洗 AI 输出中的异常 Markdown |
| 会员 UI | `frontend/src/components/Pricing.jsx` | 套餐卡片与支付入口 |
| 用户菜单 | `frontend/src/components/Header.jsx` | 免费/VIP 铭牌、到期时间、退出登录 |

## 数据表

SQLite 数据库位于 `backend/data/saveany.sqlite3`，已被 `.gitignore` 忽略。

| 表 | 说明 |
| --- | --- |
| `users` | 用户邮箱、密码哈希、Stripe customer id |
| `sessions` | HttpOnly Cookie 对应的服务端 Session |
| `memberships` | 会员状态、套餐、到期时间 |
| `checkout_sessions` | 本地记录 Stripe Checkout Session，支持幂等和同步 |
| `stripe_events` | Webhook event id 去重 |
| `ai_usage` | 免费 AI 总结每日使用次数 |
| `ai_usage_resources` | AI 总结按视频资源去重 |

## 支付安全设计

- 只有登录用户可以创建 Checkout Session。
- Stripe Secret Key 只存在后端环境变量。
- Webhook 使用 `Stripe-Signature` 校验签名。
- Webhook 事件按 `event.id` 去重。
- Checkout Session 在本地保存 pending 状态，避免用户连续点击产生大量支付链接。
- 支付成功后以后端 Stripe 状态为准，不信任前端跳转参数。
- 提供 `/api/billing/sync-checkout` 作为 Webhook 本地调试失败时的兜底同步。

## 已验证项

- 后端 Python 编译检查。
- 前端 `npm run build`。
- Stripe 测试支付成功后会员生效。
- 支付成功刷新后仍能保持 VIP 状态。
- 免费用户 AI 总结每日 3 次限制。
- AI 次数预扣、失败回滚、同视频幂等。
- AI Markdown 异常格式清洗。

## 后续建议

- 增加 AI 总结结果缓存，降低同一视频重复生成成本。
- 增加后台管理页，方便查看用户、订单、会员和 AI 次数。
- 生产环境将 SQLite 迁移到 PostgreSQL/MySQL。
- 增加 Docker/Nginx 部署方案。
- 生产环境启用 HTTPS，并设置 Cookie `secure=true`。
