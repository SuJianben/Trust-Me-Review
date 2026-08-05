# 2026-08-05｜评论媒体改用 Shopify Files

## 本次目标

取消 Cloudflare R2 依赖，将邀评评论的图片和视频存入各店铺自己的 Shopify Files。

## 修改范围

- 新增 Shopify Files 的分段上传、文件创建、文件查询和删除服务。
- Worker 媒体上传、删除、过期清理与隐私清理改为调用 Shopify Files。
- 数据库新增 Shopify 文件 ID、可公开访问 URL、处理状态和存储提供方字段；评论数据库仍只保存元数据，不保存图片或视频本体。
- 删除 Worker 的 R2 绑定与环境类型，避免 Cloudflare 账户开通 R2 订阅。
- Shopify 应用请求新增 `write_files` 权限，供应用在店铺的 Files 中创建和删除评论附件。

## 影响范围

- 仅影响邀评链接内的图片/视频上传和前台媒体读取。
- 已验收的公开评论、审核、回复、邀评排程和产品管理逻辑不变。
- Shopify Files 的文件会出现在店铺后台“内容 > 文件”中；数据库通过 Shopify File ID 追踪其归属。

## 自检

- TypeScript 类型检查通过。
- 自动化测试 8 个文件、25 条用例全部通过。
- 生产构建通过；Wrangler dry-run 配置检查通过，确认部署配置中已不存在 R2 绑定。

## 遗留事项

- 需要在 Supabase 执行 `0007_shopify_files_review_media.sql`，并发布 Shopify 权限配置后重新安装应用，才能做真实上传验证。
