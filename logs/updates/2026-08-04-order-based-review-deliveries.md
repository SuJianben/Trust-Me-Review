# 2026-08-04｜按订单合并邀评

## 本次目标

将邀评规则调整为“一个已履约订单对应一封邀评”，同一订单内的多个商品各自保留一个一次性评价链接；不同订单默认互不影响。

## 修改范围

- `db/migrations/0005_order_based_review_deliveries.sql`
  - 将每订单商品上限默认调整为 10。
  - 将跨订单客户冷却默认调整为 0，允许客户每个新订单独立收到邀评。
  - 增加按订单投递查询索引；保留商品级任务与令牌，兼容已有数据。
- `src/features/requests/scheduling-service.ts`
  - 同一订单内的商品使用同一个到期时间，不再按商品间隔拆开发送。
  - 保留可选的跨订单冷却设置，默认关闭。
- `src/features/requests/service.ts`
  - 到期任务按店铺与订单合并入队。
  - 测试投递一次性处理同订单的所有待投递商品，写入多个评价链接。
  - 失败重试和失败记录按订单成组处理，重复队列消息保持幂等；投递更新与埋点在同一事务中完成。
- `src/features/requests/delivery-view-service.ts`
  - 将历史商品级投递行聚合成后台的一条订单记录，并兼容旧版单链接记录。
- `src/worker.ts`、`src/admin/features/deliveries/TestDeliveriesPanel.tsx`
  - 测试邀评接口与页面改为展示订单、商品列表和每个商品的评价链接；仪表盘邀评统计按订单去重。
- `RequestSchedulingPanel.tsx`、设置默认值与 schema
  - 去掉“商品间隔天数”设置，改为订单合并说明。
  - 明确跨订单冷却为可选项，默认 0。

## 影响范围

- 新订单：履约后按统一延迟到期，一次投递记录可包含多个商品链接。
- 已有任务：不重算商品令牌；到期处理时会按订单合并尚未发送的商品行。
- 客户：默认每个订单独立处理；设置跨订单冷却后才会抑制后续订单。
- 真实邮件：仍未启用，后台继续保存测试投递记录。

## 自检结果

- `npm run typecheck`：通过。
- `npm test`：8 个测试文件、22 项测试通过。
- `npm run build`：通过，Worker deploy dry-run 通过。
- 已新增订单聚合、同一订单统一到期时间和默认设置测试。

## 上线前置

- 需先在 Supabase SQL Editor 执行 `db/migrations/0005_order_based_review_deliveries.sql`，再部署 Worker。
- 执行迁移会把仍保持旧版默认组合的设置行转换为每订单商品上限 10、跨订单冷却 0；已经自定义过的店铺设置会保留。

## 遗留事项

- `request_spacing_days` 数据列暂时保留用于兼容旧配置，但不再参与订单内排期；后续数据库清理阶段再移除。
- 真实邮件提供商、批量历史订单邀评和退订中心仍不在 V1 范围内。
