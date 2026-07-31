# 2026-07-31｜单商品详情 Handle 与日期范围筛选

## 本次目标

完善 Product management 单商品详情页：

- 补齐商品 `handle` 展示，避免详情卡片显示 `Not available`。
- 将商品统计图右上角的固定 `Last 12 months` 改为可选择日期范围的下拉菜单。

## 修改范围

- `src/features/products/trend-range.ts`（新增）
- `src/features/products/service.ts`
- `src/features/products/admin-service.ts`
- `src/admin/features/products/ProductDetailPanel.tsx`
- `src/admin/features/products/product-detail.css`
- `src/worker.ts`
- `tests/product-trend-range.test.ts`（新增）

## 新增内容

- 新增商品趋势日期范围工具，支持：
  - Yesterday
  - Today
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - Last 12 months
  - All time
  - Custom
- 新增商品趋势测试，覆盖近 12 个月月度分桶和自定义日期范围日分桶。

## 调整内容

- Shopify 商品快照补全逻辑从只补标题和主图，扩展为补标题、主图和 `handle`。
- 商品详情接口支持 `range`、`start`、`end` 查询参数，并按所选日期范围返回趋势图数据。
- 单商品详情页右上角日期范围改为可点击下拉菜单，自定义范围使用日期输入框提交。
- 趋势图根据当前范围自动切换日 / 月维度，长周期减少横轴文字拥挤。

## 影响范围

- 仅影响后台 Settings → Product management → 单商品详情页。
- 不改变评论提交、审核、隐藏、删除、回复、邀评生成和商品列表筛选逻辑。
- 历史商品如果缺少 handle，会在详情页读取时通过 Shopify 产品接口补齐缓存。

## 自检

- `npm run typecheck`：通过。
- `npm run test`：5 个测试文件、12 个测试全部通过。
- `npm run build`：通过。
- `git diff --check`：通过。
- 已发布 Worker 版本 `b1785e0f-1f51-405a-bb7d-9d1cff0ac848`。

## 遗留问题

- 日期范围选择器当前为基础下拉 + 日期输入，并非完整日历组件；如后续需要更贴近 Shopify/Judge.me 的日期面板，可单独做视觉增强。
