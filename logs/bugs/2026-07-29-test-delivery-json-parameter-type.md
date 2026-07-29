# 2026-07-29｜测试邀评任务无法转为已发送

## 现象

开发店已履约订单的测试邀评记录状态持续为 `scheduled`。手动触发到期任务后，后台提示已入队，但刷新后仍未生成评价链接。

## 影响范围

- 影响测试邀评任务从队列消费后转为 `sent`。
- 不影响公开评论、评论审核或 Shopify 订单履约 Webhook 创建邀评任务。

## 根因与证据

Cloudflare Worker 实时日志记录队列消费者失败：`could not determine data type of parameter $2`。

`createTestDelivery` 使用 PostgreSQL `jsonb_build_object` 写入评价链接时，第二个参数没有明确的数据库类型；PostgreSQL 无法推断该参数的类型，导致事务失败并触发队列重试。

## 修复

- `src/features/requests/service.ts`：将评价链接参数显式转换为 `$2::text`。
- 保留现有幂等条件：消费者只处理仍为 `scheduled` 的任务；部署后旧任务的重试可以继续完成，不会产生重复测试链接。

## 验证状态

- 待部署后运行自动检查并观察队列消费者将已有任务更新为 `sent`。
