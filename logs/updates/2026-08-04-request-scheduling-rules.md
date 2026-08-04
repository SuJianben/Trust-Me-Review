# 2026-08-04｜邀评调度规则与客户 Blocklist

## 本次目标

将现有“履约后统一延迟邀评”扩展为可配置的邀评调度规则，同时保留 V1 测试投递模式。

## 修改范围

- `db/migrations/0004_request_scheduling_rules.sql`
  - 新增每订单邀评商品上限、商品选择策略、邀评间隔、客户邀评冷却期字段。
  - 新增按店铺隔离的 `review_request_blocklist` 表；仅保存邮箱哈希与掩码展示值，不保存可读的客户邮箱。
- `src/features/requests/scheduling-service.ts`
  - 新增履约订单的邀评资格判断与任务创建服务。
  - 支持按价格优先或按订单行项目顺序选择商品、按商品间隔排期、客户频率限制和 Blocklist 拦截。
- `src/worker.ts`
  - 履约 webhook 改为调用统一调度服务。
  - 新增 Blocklist 的读取、添加、删除后台接口。
  - 保存调度设置、Blocklist 变更和履约邀评判定均写入审计/埋点记录。
- `src/admin/features/settings/RequestSchedulingPanel.tsx`
  - 扩展为 Timing、Multi-product orders、Customer request limit 和 Blocklist 四个实际可用区域。
- `src/admin/features/settings/RequestBlocklistPanel.tsx`
  - 新增客户 Blocklist 管理组件。
- `src/admin/features/settings/useShopSettings.ts`、`types.ts`、`src/features/reviews/schemas.ts`
  - 扩展设置类型、前后端参数校验与保存请求。
- `tests/scheduling-rules.test.ts`、`tests/settings-schema.test.ts`
  - 新增商品选择、邀评间隔和设置边界测试。

## 影响范围

- 新规则仅影响迁移执行后新收到的 `orders/fulfilled` webhook；已有 scheduled/sent 邀评任务不被重算或取消。
- 同一订单、同一商品仍由数据库唯一约束保证不会重复创建任务。
- 默认规则：履约后 14 天、每订单 1 个商品、优先最高价、商品间隔 5 天、同一客户 30 天内最多获得一次邀评。

## 自检结果

- `npm run typecheck`：通过。
- `npm test`：7 个测试文件、18 项测试通过。
- `npm run build`：通过，包含 Worker deploy dry-run。

## 上线前置

- 需先在 Supabase 执行 `0004_request_scheduling_rules.sql`，再部署 Worker；否则新调度设置字段和 Blocklist 表不存在，保存新设置会失败。

## 遗留事项

- 不包含自定义商品延迟、提醒邮件、按国家/POS 分组、批量历史订单邀评、优惠券、真实邮件/SMS/Push 渠道与退订中心；这些保持后续阶段逐项实现。
