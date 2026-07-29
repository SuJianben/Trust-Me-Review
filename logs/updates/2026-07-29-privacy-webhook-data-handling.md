# 2026-07-29｜隐私 Webhook 数据处理

## 本次目标

完成 Shopify 强制隐私 Webhook 的 V1 数据处理闭环，减少不必要的个人数据留存，并保留不含个人内容的处理审计记录。

## 修改范围

- `src/features/privacy/service.ts`
- `src/worker.ts`
- `tests/privacy.test.ts`

## 新增内容

- 接收 `customers/data_request` 时创建隐私处理审计记录。
- 接收 `customers/redact` 时，按客户邮箱哈希删除对应邀评任务与关联的邀请评论。
- 接收 `shop/redact` 时删除店铺业务数据、埋点与该店铺 Webhook 原始载荷。
- 应用卸载时取消尚未完成的邀评任务，并擦除任务中的可识别客户数据和测试邮件内容。
- 邀评评论保存来源客户邮箱哈希，便于后续精确删除。
- 所有已处理 Webhook 都会清空原始 payload，避免长期保存订单或客户载荷。

## 影响范围

- 已发布的评论展示、审核、商家回复和邀评发送逻辑不改变。
- 客户删除或店铺删除后，对应数据不会再在应用中保留。

## 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、7 个测试全部通过。
- `npm run build`：通过，包含 Worker 部署预检。

## 遗留验证

- 尚未在测试店实际触发卸载与 Shopify 隐私 Webhook；该验证会改变测试店应用安装状态，应在确认后执行。
