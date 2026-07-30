# 2026-07-30｜评论运营后台重构

## 本次目标

参考 Judge.me 的信息层级，将 Trust Me Review 已具备的 V1 功能组织为更清晰、紧凑的 Shopify 嵌入式评论运营工作台；不添加尚无后端能力的 AI、标签、导入导出或客户问答功能。

## 修改范围

- `src/admin/admin.css`
- `src/admin/main.tsx`
- `src/admin/features/reviews/ReviewsPanel.tsx`
- `src/admin/features/deliveries/TestDeliveriesPanel.tsx`
- `src/admin/features/settings/SettingsPanel.tsx`
- `src/worker.ts`

## 新增与调整

- 后台主导航调整为 Reviews、Review requests、Settings。
- 评论页改为运营工作台布局：状态 Tab、来源筛选、评分筛选、关键词搜索、密集评论行与行内操作。
- 评论行展示客户、来源、创建时间、星级、正文、商家回复、状态和操作。
- 状态可直接切换；回复、置顶、删除沿用既有真实接口。
- Review requests 与 Settings 页面统一为同一工作台的标题、说明和操作层级。
- 后端评论列表增加来源、评分和关键词筛选，所有筛选均真实执行数据库查询。

## 影响范围

- 不改变公开评论、邀评、审核、回复、隐藏、删除、置顶的业务规则。
- 不新增 AI 情感分析、标签、导入导出或客户问答功能。
- 中英文文案优化仍按用户决定暂缓。

## 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、7 个测试全部通过。
- `npm run build`：通过。
- Cloudflare Worker 已发布，健康检查返回 `200`。
- 已发布的前台评论接口仍返回正常评论总数。

## 遗留验证

- 需在已登录的 Shopify 测试店刷新后台，进行一次实际视觉与筛选/操作验收。

## 筛选错误状态修复（补充）

- 通过 Shopify 测试店的真实嵌入式后台复现 `Pending` 筛选：Worker 请求成功，页面正确返回 `0 matching`。
- 修复评论列表在后续成功请求后未清除旧错误条的问题；本次请求失败时仍会显示当前错误。
- BUG 根因已同步更新至 `logs/bugs/2026-07-30-admin-status-filter-object-error.md`，避免将已排除的数据库错误当作结论保留。
- 已在 `trust-me-review-test` 的真实 Shopify 嵌入式后台复验：重新加载后点击 `Pending`，显示 `0 matching` 和空状态，且不再出现红色错误条。
