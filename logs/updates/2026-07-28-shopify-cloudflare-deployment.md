# 2026-07-28｜Shopify 与 Cloudflare 部署

## 本次目标

将 Trust Me Review V1 连接到 Shopify 开发店，并发布 Cloudflare Worker、Theme App Extension 与 Shopify Webhook 配置。

## 修改范围

- `shopify.app.toml`：新增 Shopify 应用的正式版本配置、OAuth 回调地址、最小访问权限与 Webhook 声明。
- `src/worker.ts`、`src/services/shopify.ts`：OAuth 授权请求与 Shopify 已发布权限统一为 `read_products,read_orders`。
- `extensions/trust-me-review-theme/blocks/*.liquid`：改为延迟加载本地脚本，避免阻塞式脚本检查错误。
- `extensions/trust-me-review-theme/locales/en.default.json`：补齐 Theme App Extension 必需的默认语言文件。
- `wrangler.jsonc`：明确保留 Cloudflare Workers 日志观测，避免部署覆盖控制台中的日志启用状态。
- `.dev.vars.example`、`src/types.ts`：移除未被 Worker 实际使用的 Turnstile Site Key 环境变量声明；前台 Site Key 仍由 Theme Editor 区块设置提供。

## 已完成

- Cloudflare Worker `trust-me-review` 已部署，公网地址返回 HTTP 200。
- Cloudflare 已确认存在四项加密 Secret：`SHOPIFY_API_KEY`、`SHOPIFY_API_SECRET`、`TURNSTILE_SECRET`、`TOKEN_SECRET`；未将任何 Secret 写入仓库。
- Shopify 应用已安装到专用开发店 `Trust Me Review Test`，后台评论管理页面可正常打开。
- Shopify CLI 已发布应用版本 `trust-me-review-3`，包含主题扩展、`orders/fulfilled`、`app/uninstalled` 与三项隐私合规 Webhook。
- 通过自定义分发解决 Shopify 对订单 Webhook 的受保护客户数据发布拦截。

## 自检

- `npm run typecheck`：通过。
- `npm test`：5 项通过。
- `npm run build`：通过，包含 Worker 部署预检。
- `shopify theme check --path extensions\\trust-me-review-theme`：通过；仅保留 Turnstile 官方外部脚本的 `RemoteAsset` 性能警告。
- `npx wrangler deploy`：部署成功。
- Shopify CLI：`trust-me-review-3` 发布成功。

## 影响与遗留事项

- 主题区块尚需在开发店主题编辑器中启用，并填写 Worker API 地址及 Turnstile Site Key，才能验证商品页评分与评论区。
- 自动邀评仍需在开发店创建并履约测试订单，验证 `orders/fulfilled` Webhook、Queue 与测试投递记录。
- Turnstile 外部脚本来自 Cloudflare 官方验证服务，保留该加载方式是公开评论防机器人校验所必需的。

## 公开评论提交修复

- 原因：Cloudflare 实时日志确认 `timeout-or-duplicate`。Turnstile 令牌只能提交一次；主题编辑器的动态重载还可能导致同一表单重复绑定提交事件。
- `extensions/trust-me-review-theme/assets/trust-me-review.js`：加入一次性初始化标记、提交中锁定按钮、验证码失效后自动重置，以及成功提交后的评论列表刷新。
- `src/services/shopify.ts`、`src/worker.ts`：增加不含评论内容、个人信息或密钥的结构化失败日志，用于后续排查验证码与接口失败。
- 待验证：发布主题扩展新版后，用新的验证码完成一次仅点击一次的公开评论提交。

## 店铺授权引导修复

- 证据：公开提交已通过 Turnstile 校验，且 Worker 未出现数据库异常；应用安装后的店铺授权记录没有写入 `shops`，前台因此返回未完成店铺连接。
- `src/worker.ts`：应用根路径收到合法的 Shopify 店铺域名且未发现有效店铺记录时，自动转入 OAuth；OAuth 回调完成后才加载嵌入式后台。
- `review-widget`：将该状态改为面向商家的明确提示，不再显示笼统的提交失败。

## OAuth 回跳修复

- 问题：OAuth 回调使用相对地址回跳；在 Shopify 嵌入式后台中会被解释为后台内部路径，导致 404。
- `src/worker.ts`：回调成功后改为跳转到该店铺的 Shopify 应用入口，并记录不含敏感信息的授权完成日志。
