# 2026-08-06 Webhook 安全测试

## 本次目标

验证 Shopify Webhook 的验签、原始请求体完整性、非法请求拦截，以及重复投递幂等规则。

## 修改范围

- `src/worker.ts`
  - 将 Hono 应用导出为命名导出，供路由安全测试直接调用；不改变默认 Worker 导出或线上路由地址。
  - 使用独立的幂等判断函数决定是否把新 Webhook 投递发送到 Queue。
- `src/features/webhooks/security.ts`
  - 新增 `shouldQueueWebhook`，只有数据库首次插入返回 1 行时才允许入队；重复 `delivery_id` 的 `ON CONFLICT DO NOTHING` 返回 0 行，不会重复入队。
- `tests/webhook-security.test.ts`
  - 新增正确 HMAC、篡改原始请求体、缺失/伪造签名、非法 JSON 提前拦截和重复投递不入队测试。

## 验证结果

- 线上 `POST /webhooks/shopify` 使用伪造签名：返回 `401 Invalid HMAC`。
- 本地自动化测试：10 个测试文件、31 个测试全部通过。
- TypeScript 类型检查通过。
- 生产构建与 Wrangler dry-run 通过。

## 影响范围

只影响 Webhook 的安全校验测试可维护性和重复投递入队判断；评论、邀评、前台展示和隐私处理逻辑未改变。

## 遗留问题

- 本次未使用真实 Shopify 密钥发送合法 Webhook，因此没有触发真实店铺数据变更；线上合法投递仍应由 Shopify 实际发送。
- 队列重试、死信队列和隐私 Webhook 的完整链路仍需在开发店验收阶段单独验证。
