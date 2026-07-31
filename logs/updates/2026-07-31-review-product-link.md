# 2026-07-31 Review 产品跳转

## 目标

让 review 列表中的产品名称可以直接进入 Product management 的对应产品详情。

## 修改范围

- `src/admin/features/reviews/ReviewsPanel.tsx`
  - 将评论行中的产品名称改为链接。
  - 使用评论记录中的 Shopify product ID 跳转到 `/products/:productId`，该页面属于 Product management。
- `src/admin/features/reviews/reviews-status.css`
  - 增加产品链接的颜色、悬停和键盘焦点样式，保持评论列表的可读性。

## 自检

- `npm run typecheck`：通过。
- `npm run test`：通过，5 个测试文件、12 个测试全部通过。
- `npm run build`：通过，Vite 构建与 Wrangler dry-run 均成功。
- `npx wrangler deploy`：成功，Worker 版本 `04faa571-de12-4e55-a253-504e5819b183`。
- 线上 `/health`：返回 `{"ok":true,"service":"trust-me-review"}`。

## 遗留问题

- 无。
