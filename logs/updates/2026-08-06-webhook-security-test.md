# 2026-08-06 Webhook 安全测试

## 本次目标

验证 Shopify Webhook 的验签、原始请求体完整性、非法请求拦截、关键请求头完整性、重复投递幂等规则，以及线上边界响应。

## 修改范围

- `src/worker.ts`
  - 将 Hono 应用导出为命名导出，供路由安全测试直接调用；不改变默认 Worker 导出或线上路由地址。
  - 使用独立的幂等判断函数决定是否把新 Webhook 投递发送到 Queue。
  - 验签通过后强制要求 Shopify 的 delivery ID、topic、shop domain 三个路由请求头。
  - 对签名正确但 JSON 损坏或顶层类型错误的请求返回 400，不再让解析异常变成 500。
- `src/features/webhooks/security.ts`
  - 新增 `shouldQueueWebhook`，只有数据库首次插入返回 1 行时才允许入队；重复 `delivery_id` 的 `ON CONFLICT DO NOTHING` 返回 0 行，不会重复入队。
  - 新增 `hasRequiredShopifyWebhookHeaders`，集中维护 Webhook 路由头校验。
- `tests/webhook-security.test.ts`
  - 新增正确 HMAC、篡改原始请求体、缺失/伪造签名、缺少 Shopify 路由头、签名正确但非法 JSON、路由头完整性和重复投递不入队测试。

## 验证结果

- 线上 `POST /webhooks/shopify` 使用伪造签名：返回 `401 Invalid HMAC`。
- 本地自动化测试：10 个测试文件、34 个测试全部通过。
- TypeScript 类型检查通过。
- 生产构建与 Wrangler dry-run 通过。
- 线上伪造签名、缺失签名、伪造签名加非法 JSON 三类请求均返回 `401 Invalid HMAC`，未进入后续处理。

## 影响范围

只影响 Webhook 入口的请求边界校验、测试可维护性和重复投递入队判断；评论、邀评、前台展示和隐私处理逻辑未改变。

## 遗留问题

- 本次未使用真实 Shopify 密钥发送合法 Webhook，因此没有触发真实店铺数据变更；线上合法投递仍需由 Shopify 实际发送来验证。
- 队列重试、死信队列和隐私 Webhook 的完整链路仍需在开发店验收阶段单独验证。
