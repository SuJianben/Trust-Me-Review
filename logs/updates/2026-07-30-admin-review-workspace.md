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

## Settings 导航状态与间距修复（补充）

- 修复 `Review requests` 和 `Request scheduling` 共用状态值导致同时高亮的问题。
- 两项现在分别对应独立页面：前者管理自动邀评开关，后者管理履约后的发送延迟天数。
- 收紧左侧导航宽度、分组间距、菜单行高和选中底色的圆角范围，使导航更紧凑。
- `npm run typecheck`、`npm test`（8 项）和 `npm run build` 均通过。
- 已发布 Worker 版本 `3206884e-fb9e-434a-a057-cae1933c1a76`。

## 完整 Product management（补充）

### 本次目标

将 Product management 从“仅显示已有评论的商品”升级为完整 Shopify 商品目录管理页，使商家能同步全店商品、查看商品图片与评论数据，并控制每个商品是否参与后续自动邀评。

### 修改范围

- `db/migrations/0003_product_management.sql`（新增）
- `src/features/products/catalog-service.ts`（新增）
- `src/features/products/schemas.ts`（新增）
- `src/features/products/admin-service.ts`
- `src/worker.ts`
- `src/admin/features/settings/ProductManagementPanel.tsx`
- `src/admin/features/settings/types.ts`
- `src/admin/features/settings/settings.css`
- `tests/product-management.test.ts`（新增）

### 新增与调整

- 商品表新增商品图片、Shopify 商品状态、商品级邀评开关和最近目录同步时间。
- Product management 增加 `Sync products`：使用店铺已授权的 Shopify 产品权限，每次同步 100 个商品并在前端自动继续下一页，支持大目录逐页同步。
- 商品管理表展示缩略图、商品名称、Shopify 商品状态、已发布平均评分、评论数、商品级邀评状态和最近评论时间。
- 增加 All products / Request active / Request inactive 筛选、商品实时关键词筛选和每页 50 条分页。
- 每个商品可打开对应商品评论列表，也可启用/停用未来履约订单的自动邀评；已存在的邀评任务保持原样，避免擅自取消商家已安排的邀请。
- 商品级开关更新会写入审核日志与不含个人内容的埋点。

### 自检

- Supabase 迁移已由商家在生产项目中成功执行。
- `npm run typecheck`：通过。
- `npm test`：4 个测试文件、10 个测试全部通过。
- `npm run build`：通过。
- Worker 健康检查、`/settings` 均返回 `200`；未携带后台身份令牌访问商品接口返回 `401`。
- 已发布 Worker 版本 `6dba1288-0ea6-4e51-bfea-829c26c7db46`。

### 遗留验证

- 需在 Shopify 测试店的 Settings → Product management 点击一次 `Sync products`，确认目录、筛选、商品开关与跳转到对应评论列表的实际链路。

## Product management 范围收缩（补充）

- 根据商家确认，Product management 不再承担全店商品目录同步；只显示至少有一条未删除评论的商品。
- 已移除全量 `Sync products` 按钮和同步接口，避免无评论商品（包括仅有邀评记录的商品）进入该页面。
- 商品级邀评开关、状态筛选、实时搜索、分页和跳转到对应评论列表继续保留。
- `npm run typecheck`、`npm test`（10 项）和 `npm run build` 均通过。
- 已发布 Worker 版本 `81354c0a-39f6-4f69-9064-bd8f06425b52`；健康检查与 `/settings` 返回 `200`，无身份令牌的商品接口返回 `401`。

## Settings 工作台视觉层级调整（补充）

- 压缩应用头部垂直留白，使 Settings 工作区和 Product management 标题整体上移。
- 左侧导航扩展为完整 Judge.me 风格的信息架构：评论收集、前台展示、折扣与奖励、集成、通用设置。
- 仅已有真实功能的条目可点击；未开发项以低对比度静态文字展示，不会伪装成可用功能。
- 左侧搜索框可实时过滤导航项，避免出现无作用的装饰性输入框。
- 工作区最大宽度调整至约 1230px；商品表格增大列间距、行高、缩略图和操作区，避免小气的拥挤排版。
- `npm run typecheck`、`npm test`（10 项）和 `npm run build` 均通过；`/settings` 返回 `200`。
- 已发布 Worker 版本 `37c78a80-0dd5-4f73-8d7f-990ecc43a97d`。

## Settings 内容区垂直布局修复（补充）

- 修复左侧导航变高后，CSS Grid 将右侧内容容器同步拉高，导致标题与商品表格被分散到上下两端的问题。
- 工作区与右侧内容区均改为按内容高度排列，Product management 表格现在紧接标题和说明显示。
- `npm run typecheck`、`npm test`（10 项）和 `npm run build` 均通过；`/settings` 返回 `200`。
- 已发布 Worker 版本 `7fb33829-ec81-4a87-8ed8-c2b740cad4b3`。

## Product management 主图与状态徽章优化（补充）

- 商品管理列表加载时，仅对已存在评论关联、且缺少标题或主图缓存的商品补查 Shopify GraphQL；主图写入既有 `products.image_url`，不恢复全店商品同步。
- `Active` / `Inactive` 邀评状态徽章改为按文字实际宽度收缩，不再填满整列。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；`/settings` 返回 `200`。
- 已发布 Worker 版本 `6550ba7d-b3a4-4843-acec-29140d380121`。

## Product management 单商品详情页

- Product management 的商品名称与主图现在可点击，进入应用内单商品详情页，而非跳转 Shopify 原生产品页。
- 详情页展示商品主图、名称、Shopify 商品 ID、Handle、商品状态、商品级邀评状态、邀评记录数和已发布评论数。
- 新增真实的近 12 个月平均评分趋势，以及该商品的独立评论审核列表；列表沿用既有评论审核逻辑，避免复制一套状态和操作代码。
- 新增后台接口 `GET /api/admin/products/:productId`，查询强制以当前店铺域名和“至少一条未删除评论”限制数据范围。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情页面路径返回 `200`，未携带 Shopify 后台身份令牌访问详情数据接口返回 `401`。
- 已发布 Worker 版本 `4e1faeb0-7687-4f53-b02f-6b4af87bf7fc`。

## 单商品详情页保留 Settings 侧栏（修复）

- 将单商品详情页装配回 Settings 工作台，不再绕开左侧导航。
- 进入详情时左侧 Product management 保持选中；返回按钮回到 `Settings → Product management` 列表。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情页与返回列表路径均返回 `200`。
- 已发布 Worker 版本 `f4cab785-47fb-47e4-92f8-d57a68f3b610`。

## 商品评分趋势悬浮提示

- 产品详情的近 12 个月评分趋势图新增节点悬浮提示，展示对应月份的评论数与平均评分；无评论月份显示 0。
- 键盘聚焦节点同样可显示提示，保留基础可访问性。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情路径返回 `200`。
- 已发布 Worker 版本 `7df47edd-dc8e-4292-8b36-a78a5e5e4371`。

## 单商品详情月度评论趋势对齐录屏

- 根据参考录屏修正趋势图含义：图表改为近 12 个月的评论数量，不再错误地表达为平均评分趋势；平均评分仍保留在统计卡中。
- 节点悬浮提示显示 `N review(s)` 与该月占商品总评论数的百分比；无评论月份统一显示 `0 review(s)` 与 `0%`。
- 月度查询与产品总评论数统一使用“未删除评论”口径，避免图表、提示和统计数字不一致；提示框补充青绿色数据标记，以贴近参考交互。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情页路径返回 `200`。
- 已发布 Worker 版本 `3cc9b987-25b9-4a9d-9474-ef3a78fb071b`。

## 月度评论趋势悬浮修复（补充）

- 修复提示框在最左、最右或高位节点时超出图表可视区而被裁切的问题：横向位置限制在图表内部，高位节点自动向下展开。
- 修复月份文字与空白区域也能触发相邻数据点的问题；现在只有绿色圆点可触发提示，因此评论月份会显示其自身真实评论数。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情页路径返回 `200`。
- 已发布 Worker 版本 `e653af87-7006-4b80-98aa-da651a37d63f`。

## 月度评论趋势提示框侧向定位（补充）

- 提示框改为显示在对应数据点一侧，并保留箭头精确指向圆点；默认在右侧，靠近右边界时自动切换至左侧。
- 保留垂直安全边距，避免顶部和底部节点的提示框被裁切。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情页路径返回 `200`。
- 已发布 Worker 版本 `10993157-8683-4522-87bb-5a9a9ff59a54`。

## 月度评论趋势提示框滚动层分离（补充）

- 将趋势图的可滚动区域与提示框分离：SVG 仍保留横向滚动，提示框改为渲染在滚动层外侧，避免被容器裁切。
- 提示框继续按数据点位置定位，并在左右边界自动选择展开方向，保留箭头指向对应圆点。
- `npm run typecheck`、`npm test`（10 项）、`npm run build` 与 `git diff --check` 均通过；详情页路径返回 `200`。
- 已发布 Worker 版本 `c109eab8-f7b7-477b-8a79-e53e0be384d0`。
