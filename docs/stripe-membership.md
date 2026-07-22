# Stripe 一次性会员支付指南

本文档记录 SaveAny 当前 Stripe 支付方案。当前实现是一次性付款，不是订阅，不会自动续费。

## 1. 套餐规则

| 套餐 | 金额 | 币种 | 有效期 | Stripe 模式 |
| --- | --- | --- | --- | --- |
| 月度会员 | 9.90 | CNY | 30 天 | `payment` |
| 年度会员 | 68.00 | CNY | 365 天 | `payment` |

说明：

- Stripe 后台需要创建 one-time price。
- 不要创建 recurring subscription price。
- 用户重复购买时，后端会从当前会员到期时间继续累加。

## 2. Stripe 后台配置

1. 打开 Stripe Dashboard。
2. 确认左上角处于 Test mode。
3. 创建两个 Product/Price：
   - 月度会员：CNY 9.90，one-time。
   - 年度会员：CNY 68.00，one-time。
4. 复制两个 Price ID，格式是 `price_xxx`。
5. 不要把 `prod_xxx` 填到环境变量里。

## 3. 后端环境变量

在 `backend/.env` 中配置：

```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FRONTEND_URL=http://localhost:3000
```

说明：

- `STRIPE_SECRET_KEY` 是后端密钥，只能放后端。
- `STRIPE_PRICE_MONTHLY` 填月度 one-time Price ID。
- `STRIPE_PRICE_YEARLY` 填年度 one-time Price ID。
- `STRIPE_WEBHOOK_SECRET` 来自 Stripe CLI 或正式 Webhook endpoint。
- `FRONTEND_URL` 用于 Checkout 成功/取消后的回跳地址。

## 4. 本地测试流程

启动后端：

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

启动前端：

```bash
cd frontend
npm run dev
```

启动 Stripe CLI：

```bash
stripe login
stripe listen --forward-to localhost:8000/api/billing/webhook
```

复制 CLI 输出：

```text
Ready! Your webhook signing secret is whsec_xxx
```

写入：

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

然后：

1. 打开 `http://localhost:3000`。
2. 注册或登录。
3. 点击开通会员。
4. 选择月度或年度套餐。
5. 跳转 Stripe Checkout。
6. 使用测试卡支付。
7. 返回网站后确认 Header 显示 VIP。
8. 刷新页面，确认 VIP 状态仍然存在。
9. 使用 AI 总结和 AI 对话验证会员权益。

## 5. 测试卡

成功支付：

```text
4242 4242 4242 4242
```

其他字段：

- 有效期：任意未来日期，例如 `12/34`
- CVC：任意 3 位数字，例如 `123`
- 邮编：任意值，例如 `10001`

## 6. 安全与幂等

当前实现包含以下保护：

- 只有登录用户可以创建 Checkout Session。
- Stripe Secret Key 不会暴露给前端。
- Webhook 使用 `Stripe-Signature` 校验签名。
- `stripe_events` 按 event id 去重，避免重复投递导致重复开通。
- `checkout_sessions` 记录本地 Session 状态，避免重复处理。
- 创建 Customer 使用 Stripe idempotency key。
- 创建 Checkout Session 使用短时间窗口 idempotency key。
- 支付成功后以后端从 Stripe 获取的状态为准，不信任前端 URL 参数。

## 7. Webhook 失败排查

如果 Stripe 后台显示支付成功，但网站没有显示 VIP：

1. 确认 `stripe listen` 仍在运行。
2. 确认 `STRIPE_WEBHOOK_SECRET` 与当前 CLI 输出一致。
3. 查看后端控制台是否有 Webhook 报错。
4. 检查 Stripe Dashboard 的 Developers -> Events。
5. 返回网站后触发 `/api/billing/sync-checkout` 兜底同步。

## 8. 上线注意事项

- 切换到 Live mode 后，重新创建正式环境 Price ID。
- 正式环境的 Secret Key、Price ID、Webhook Secret 与测试环境分开管理。
- 不要把真实密钥写入文档或提交到 Git。
- 正式 Webhook endpoint 应配置为：

```text
https://your-domain.com/api/billing/webhook
```

- `FRONTEND_URL` 应设置为正式域名。
