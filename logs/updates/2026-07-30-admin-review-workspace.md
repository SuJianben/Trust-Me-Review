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

## 主级 Dashboard 布局完成（补充）

### 本次目标

以 Judge.me 数据面板的信息层级为参考，完成 Trust Me Review 主级 Dashboard 的正式运营布局；只复用可验证的真实店铺数据，不复制 Judge.me 品牌、广告内容或虚假的功能入口。

### 修改范围

- `src/admin/features/dashboard/DashboardPanel.tsx`
- `src/admin/dashboard.css`
- `src/admin/Admin.tsx`

### 新增与调整

- 增加蓝色概览横幅、数据摘要区、状态区、两项真实待办入口，以及“热门商品 / 最近评论”双栏数据区。
- 五项摘要均取自当前店铺真实数据：评论总数、平均评分、已发送邀评、已发布评论、待审核评论。
- 状态区展示真实的待审核、已发布、待发送和已发送数量；无待审核时显示已处理完成。
- `Manage reviews` 跳转至评论管理，`Review requests` 跳转至邀评记录；两个入口不再是静态展示按钮。
- 样式独立集中在 `dashboard.css`，并补充平板与手机尺寸下的单列排版。

### 影响范围

- 仅调整主级 Dashboard 的展示与页面内导航，不改变评论、邀评、审核或设置的业务逻辑。
- 不新增广告卡片、订阅引导、虚构指标或无对应后端能力的按钮。

### 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、8 个测试全部通过。
- `npm run build`：通过。
- 已发布 Worker 版本 `44266b05-eca3-429f-b163-47e27ab6c7bb`。
- 已在真实 Shopify 测试店验证 Dashboard 呈现，并完成 `Dashboard → Reviews → Dashboard` 与 `Dashboard → Review requests → Dashboard` 两条跳转链路。

## Dashboard 精简布局（补充）

- 根据验收反馈，移除“Moderate customer feedback”和“Collect verified reviews”两张操作引导卡。
- Dashboard 内容区调整为居中且最大宽度约 1056px，避免在宽屏 Shopify 后台中横向拉得过大。
- 保留真实概览、状态、热门商品和最近评论数据，不影响其他后台功能。
- `npm run typecheck`、`npm test`（8 项）和 `npm run build` 均通过。
- 已发布 Worker 版本 `221cce62-c10d-4b7e-a906-89bfcc036d4c`。

## Shopify 左侧 Reviews 子级（补充）

### 本次目标

将 Reviews 从应用主页面的顶部切换项调整为 Shopify 嵌入式后台左侧的真实子级页面；保留已完成的邀评记录功能。

### 修改范围

- `src/admin/Admin.tsx`
- `src/admin/components/AppNavigation.tsx`（新增）
- `src/admin/components/shopify-app-bridge.d.ts`（新增）
- `src/admin/features/reviews/ReviewsWorkspace.tsx`（新增）
- `src/admin/admin.css`

### 新增与调整

- 应用根路径 `/` 继续作为主级 Dashboard。
- 使用 Shopify App Bridge 的应用导航组件，将 `Reviews` 和已有功能的 `Settings` 放入 Shopify 左侧应用子级导航。
- `Reviews` 改为独立地址 `/reviews`；其中保留本地 `Reviews / Review requests` 两个页签，确保评论审核与测试邀评记录仍能连续使用。
- `Settings` 改为独立地址 `/settings`。
- `Resources` 暂未加入导航：该页面尚未开始制作，避免出现点击无效果的空入口。
- Worker 既有 SPA 回退继续生效，`/reviews` 和 `/settings` 刷新时均可正确返回应用页面。

### 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、8 个测试全部通过。
- `npm run build`：通过。
- Worker 根路径、`/reviews`、`/settings` 真实请求均返回 `200`。
- 已发布 Worker 版本 `9f2eb6bb-beb7-49ee-b5cd-9a8f804f84e8`。
- 自动 Shopify 后台视觉验证未能复用当前已登录测试店会话；需要在用户的测试店后台刷新一次，确认左侧导航呈现与点击跳转。

## Settings 子级工作台（补充）

### 本次目标

将原有单张 Settings 表单升级为独立的设置子级工作台，采用“左侧设置分类 + 右侧当前内容”的运营后台结构，并实现真实的 Product management。

### 修改范围

- `src/admin/Admin.tsx`
- `src/admin/features/settings/SettingsWorkspace.tsx`（新增）
- `src/admin/features/settings/SettingsNavigation.tsx`（新增）
- `src/admin/features/settings/SettingsPanel.tsx`
- `src/admin/features/settings/ProductManagementPanel.tsx`（新增）
- `src/admin/features/settings/types.ts`（新增）
- `src/admin/features/settings/settings.css`（新增）
- `src/features/products/admin-service.ts`（新增）
- `src/worker.ts`
- `src/admin/features/reviews/ReviewsWorkspace.tsx`
- `src/admin/features/reviews/ReviewsPanel.tsx`

### 新增与调整

- Settings 页面改为两栏工作台，左侧按评论收集、前台显示和通用设置分组。
- 已有真实设置按职责拆分为邀评计划、邀请邮件主题、前台显示及语言与通知页面，并继续使用原有保存接口。
- Product management 读取当前店铺由评论或邀评流程产生的真实商品映射，展示评论数、已发布数、待审核数、平均评分、邀评数和最近评论时间。
- 每个商品的 `View reviews` 可跳转到对应商品筛选后的 Reviews 页面；评论列表接口新增受参数化保护的商品筛选条件。
- 没有后端能力的导入、Bundles、Widgets、优惠券、AI 等项目仅以分类文字展示，未伪造可执行功能。

### 自检

- `npm run typecheck`：通过。
- `npm test`：3 个测试文件、8 个测试全部通过。
- `npm run build`：通过。
- `/settings` 与 `/reviews` 真实请求均返回 `200`；`/api/admin/products` 未携带 Shopify 身份令牌时返回 `401`，符合后台接口保护规则。
- 已发布 Worker 版本 `6a48dd36-5c48-4e17-ba33-f932a1470a4d`。
