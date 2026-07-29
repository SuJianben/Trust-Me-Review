# 2026-07-29｜评论控制与邀评失败恢复

## 本次目标

补齐 V1 在评论阅读、评论管理和测试邀评异常恢复上的功能缺口；不进行中英文文案与视觉风格优化。

## 修改范围

- `db/migrations/0002_review_delivery_failure_reason.sql`
- `src/features/reviews/service.ts`
- `src/features/requests/service.ts`
- `src/worker.ts`
- `src/admin/features/reviews/ReviewsPanel.tsx`
- `src/admin/features/deliveries/TestDeliveriesPanel.tsx`
- `extensions/trust-me-review-theme/blocks/review-widget.liquid`
- `extensions/trust-me-review-theme/assets/trust-me-review.js`
- `extensions/trust-me-review-theme/assets/trust-me-review.css`

## 新增内容

- 前台评论区增加 1 到 5 星评分分布。
- 前台支持按最新、最高评分、最低评分排序，并提供每页 10 条的翻页控制。
- 星级徽章读取真实的评分和评论数。
- 商家后台增加删除评论操作；删除状态不会在前台读取。
- 测试邀评记录显示最近失败原因与尝试次数。
- 队列处理失败时记录原因；达到队列最终尝试后标记为失败，商家可手动重新入队。

## 数据库变更

- 已在 Supabase 执行 `review_requests.failure_reason` 字段新增 SQL。
- 代码库保留独立迁移文件，方便后续环境同步。

## 影响范围

- 公开评论、邀请评论、审核、隐藏、回复和已购验证的既有流程保持不变。
- 中英文文案和视觉设计按当前决定暂不调整。

## 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、7 个测试全部通过。
- `npm run build`：通过。
- Cloudflare Worker 健康检查：`200`。
- 已发布的前台接口返回：评分 `4.0`、评论数 `1`、评分分布 `4 星 = 1`、最高评分排序正常。
- Shopify 主题扩展已发布：`trust-me-review-6`。

## 遗留问题

- Shopify Theme Check 对 Turnstile 远程脚本有 CDN 提示；该脚本是 Cloudflare Turnstile 必需的官方加载地址，不影响本次功能发布。
