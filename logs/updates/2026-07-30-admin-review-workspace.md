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

## Pending 状态切换修复（补充）

- 复查后确认：顶部 `Pending` Tab 的查询可正常工作；真正失败的是评论行内状态下拉框选择 `Pending`。
- 后端审核验证此前遗漏 `pending`，且把 `status` 设为必填，和后台实际支持的状态与单独置顶操作不一致。
- 现已统一状态验证规则，支持 `pending`、`published`、`hidden`、`deleted`，并允许独立更新置顶状态。
- 前端错误处理也已改为解析服务端结构化错误，避免显示 `[object Object]`。
- 已发布 Worker 版本 `66a7ace1-3174-499c-a119-3685835f3e5e`。
- 真实 Shopify 嵌入式后台已完成 `Published → Pending → Pending Tab 筛选 → Published` 全链路验证，未出现错误横幅。

## 评论实时搜索（补充）

- 移除手动搜索按钮，评论关键词改为输入后自动筛选。
- 设置 250 毫秒输入停顿，减少连续输入时的重复请求。
- 清空搜索框立即移除关键词条件，恢复当前状态、来源和评分筛选条件下的全部评论。
- 已在真实 Shopify 嵌入式后台验证“输入关键词 → 仅显示匹配项 → 清空 → All reviews”完整流程。
- 已发布 Worker 版本 `303dee98-140c-482d-a453-0a6f4a1384c0`。

## 评论与商品联动（补充）

- 后台每条评论的客户信息下新增对应商品名称，便于商家识别评论归属。
- 公开评论提交从主题商品页读取并保存商品标题；订单履约邀评从 Shopify 订单行项目保存商品标题。
- 对早期未保存标题的商品，后台首次读取评论时通过已授权的 Shopify `read_products` 权限补取标题并写回数据库。
- 标题临时无法读取时，安全回退显示 `Product #商品ID`，不会丢失评论归属。
- 已在真实 Shopify 后台验证历史评论显示 `Review Test Product` 与 `Gift Card`，无错误横幅。
- 已发布 Worker 版本 `9a15dc1e-dada-40e8-a6f0-07b63a12f09c`，Theme App Extension 已发布版本 `trust-me-review-7`。

## 主级 Dashboard（补充）

- 根据新的信息架构，应用默认首页改为主级 Dashboard；后续将逐步整理为 Reviews、Settings、Resources 三个子级。
- 本轮只实现 Dashboard，不提前改动 Reviews、Settings、Resources 的内部功能结构。
- Dashboard 仅展示当前店铺的真实数据：有效评论数、已发布评论数、待审核数、已发布评论平均分、已发送邀评数、待发送邀评数、热门商品和最近评论。
- 未加入广告、订阅、增长推广或任何无法由当前数据支撑的指标。
- 聚合查询使用独立子查询计算评论和邀评任务，避免两个表联表统计时互相放大计数。

### 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、8 个测试全部通过。
- `npm run build`：通过。
- 已发布 Worker 版本 `c5210da9-0eb6-4536-8c99-dd31879697dc`。
- 已在 Shopify 测试店真实验证：Dashboard 默认打开、指标正确显示，`Manage reviews` 可进入评论管理页。
