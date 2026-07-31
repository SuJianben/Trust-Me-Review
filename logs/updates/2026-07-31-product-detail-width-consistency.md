# 2026-07-31 产品详情统计视图宽度一致性

## 目标

让 Total reviews、Reviews with media、Average rating 三种统计视图保持同一套产品详情面板宽度与侧边栏布局。

## 修改范围

- 固定设置页工作区在其既有最大宽度内占据完整可用宽度。
- 固定产品详情页面占满右侧内容列。

## 自检

- `npm run typecheck`：通过。
- `npm run test`：5 个测试文件、12 项测试全部通过。
- `npm run build`：通过，包含 Worker 部署预检。
- 已发布 Worker 版本 `848ec36d-40a3-4158-a5b0-e6c7ccabe1b4`，线上 `/health` 返回 `ok: true`。
- 待用户刷新 Shopify 嵌入式后台，确认三个统计视图切换后右侧区域宽度一致。

## 遗留问题

V1 尚未实现图片/视频上传；因此媒体评论视图在没有媒体数据时会保持空状态，但面板宽度不应变化。
