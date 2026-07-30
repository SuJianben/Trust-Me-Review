# 2026-07-30｜后台评论状态切换 Pending 失败

## 现象

在评论运营后台的行内状态下拉框将评论切换为 `Pending` 时，页面显示 `[object Object]` 或通用的“Request failed”错误；顶部 `Pending` Tab 本身并不是故障点。

## 影响范围

- 影响商家将现有评论重新放回待审核状态。
- 同一接口的独立置顶操作也有潜在验证失败风险。
- 不影响公开评论提交、邀评评论提交、发布、隐藏、删除和前台展示。

## 根因

前两次排查把问题归因于前端错误展示和列表重复加载；这些调整改善了错误提示和加载稳定性，但没有覆盖真正的请求验证问题。

真实根因是后端 `moderationSchema` 只允许 `published`、`hidden`、`deleted` 三种状态，并且强制要求 `status` 字段；但后台状态下拉框同时提供 `pending`，置顶操作则只发送 `pinned`。因此选择 `Pending` 会被服务端验证拒绝，并返回一个结构化错误对象，前端最终显示为通用失败提示。

## 修复

- 提取统一的评论状态验证规则，明确允许 `pending`、`published`、`hidden`、`deleted`。
- 审核更新接口允许单独更新状态或置顶值，但拒绝空更新请求。
- 更新 SQL：未传状态时保留原状态；状态变更时正确维护发布时间和删除时间。
- 前端 API 层将服务端结构化错误转换为可读文字，避免再次出现 `[object Object]`。

## 验证状态

- 本地：`npm run typecheck`、`npm test`（3 个测试文件 / 8 个测试）、`npm run build` 均通过。
- 已发布 Worker 版本 `66a7ace1-3174-499c-a119-3685835f3e5e`。
- 真实 Shopify 嵌入式后台完成：`Published → Pending → Pending Tab 筛选 → Published`；四步均成功，未出现错误横幅。
- 状态：已修复并完成真实链路验证。
