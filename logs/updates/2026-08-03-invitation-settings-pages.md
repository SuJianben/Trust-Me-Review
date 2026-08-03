# 2026-08-03｜邀评设置页面

## 本次目标

将 V1 已验收的测试邀评能力整理到 Settings 子级中，让商家能在同一处配置邀评开关、履约后的发送延迟和双语邀评主题，并查看及手动处理测试投递记录。

## 修改范围

- `src/admin/features/settings/useShopSettings.ts`
  - 新增共享设置加载与保存逻辑，统一读取和提交现有 `/api/admin/settings` 接口。
- `src/admin/features/settings/ReviewRequestsPanel.tsx`
  - 新增邀评开关页面，并复用测试投递记录、到期手动执行及失败重试能力。
- `src/admin/features/settings/RequestSchedulingPanel.tsx`
  - 新增履约后延迟天数设置，范围为 0 至 90 天。
- `src/admin/features/settings/EmailTemplatesPanel.tsx`
  - 新增中英文邀评主题设置，并明确 V1 仅记录测试投递、不发送真实邮件。
- `src/admin/features/settings/SettingsWorkspace.tsx`
  - 将上述三个 Settings 导航项连接至独立页面。
- `src/admin/features/settings/SettingsPanel.tsx`
  - 保留已有的前台显示与语言通知设置，改为复用共享设置逻辑。
- `src/admin/features/reviews/ReviewsWorkspace.tsx`
  - 移除 Reviews 页面中重复的“Review requests”标签；邀评记录统一从 Settings 管理。
- `src/admin/features/deliveries/TestDeliveriesPanel.tsx`
  - 将卡片标题调整为“Test delivery records”，避免与页面标题重复。
- `src/admin/features/settings/settings.css`
  - 补充这三个设置页的表单间距和双语主题字段布局。
- `tests/settings-schema.test.ts`
  - 新增邀评设置的参数边界测试。

## 影响范围

- 不涉及数据库表或迁移。
- 不改变订单履约、队列、Cron 或测试邀评令牌的既有逻辑。
- 商家原先在 Reviews 页面查看测试投递记录的入口移至 Settings > Review requests。

## 自检结果

- `npm run typecheck`：通过。
- `npm run test`：6 个测试文件、14 项测试全部通过。
- `npm run build`：通过，包含 Worker dry-run。
- 已发布 Cloudflare Worker：`61dd8efd-4389-4d55-892d-e024d06d12ab`。
- 线上健康检查：`GET /health` 返回 HTTP 200 与 `ok: true`。

## 遗留事项

- 需要在 Shopify 开发店手动确认三个 Settings 页面保存后刷新仍保持配置；这是嵌入式后台的真实验收步骤。
