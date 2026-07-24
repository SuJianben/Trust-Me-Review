# Trust Me Review

Shopify 评论应用（V1）：双语评论展示、商家审核、已购验证和测试邀评流程。

## 本地启动

1. 复制 `.dev.vars.example` 为 `.dev.vars` 并填写密钥。
2. 创建 Supabase PostgreSQL 项目，使用其连接串创建 Cloudflare Hyperdrive。
3. `npm install && npm run db:migrate && npm run dev`。
4. 在 Shopify Dev Dashboard 创建应用，按 `shopify.app.toml.example` 填写 URL 与回调地址。

## 部署前检查

- 使用 `npx wrangler whoami` 确认 Cloudflare 登录；创建两个队列和 Hyperdrive 后替换 `wrangler.jsonc` 中的 ID。
- 使用 `npx wrangler secret put` 写入 Shopify、Turnstile、数据库和令牌密钥。
- 将 Theme App Extension 用 Shopify CLI 部署并在开发店主题编辑器中启用。

真实邮件服务有意不在 V1 启用；邀评内容与链接会保存为后台可查看的测试投递记录。
