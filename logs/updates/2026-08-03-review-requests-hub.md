# 2026-08-03｜Review requests 邀评总面板

## 本次目标

参考 Judge.me 的信息结构，将 Review requests 从单一配置页面调整为邀评渠道总面板，并保留已实现的邮件邀评配置与测试投递链路。

## 修改范围

- `src/admin/features/settings/ReviewRequestsPanel.tsx`
  - 改为邀评总面板，展示历史订单、客户名单和各类收集渠道。
  - 仅“Manage email review requests”可进入真实功能；其余未实现渠道明确显示为 Coming soon，不能触发无效操作。
- `src/admin/features/settings/EmailReviewRequestsPanel.tsx`
  - 新增邮件邀评管理页，承接原有自动邀评开关、保存操作与测试投递记录。
- `src/admin/features/settings/SettingsWorkspace.tsx`
  - 新增 `email-requests` 页面状态并处理总面板与邮件管理页之间的导航。
- `src/admin/features/settings/types.ts`
  - 扩充 Settings 页面状态类型。
- `src/admin/features/settings/review-requests.css`
  - 新增邀评总面板和渠道列表的局部样式，避免影响其它 Settings 页面。

## 影响范围

- 不修改数据库、订单履约、队列或邀评令牌逻辑。
- 既有 Review requests 菜单仍进入邀评页面；自动邮件开关和测试投递记录改由页面内的 Manage 入口打开。

## 自检结果

- `npm run typecheck`：通过。
- `npm run test`：6 个测试文件、14 项测试通过。
- `npm run build`：通过，包含 Worker dry-run。
- 已发布 Cloudflare Worker：`f97941c4-46ef-4665-9f22-8d9694ce4291`。
- 线上健康检查：`GET /health` 返回 HTTP 200 与 `ok: true`。

## 遗留事项

- 历史订单批量邀评、客户名单邀评、链接/二维码、SMS、Push 和 WhatsApp 集成仅展示，不包含后端逻辑；后续按功能逐项开发。
