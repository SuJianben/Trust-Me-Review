# 2026-08-06｜邀评媒体上传后预览消失

## 现象

客户在邀评页选择图片或视频时可先看到本地预览；上传完成后预览消失，评论无法提交。

## 影响范围

- 影响邀评页的图片、视频媒体上传与后续提交。
- 不影响纯文字邀评、公开评论和既有评论的审核状态。

## 根因与证据

Worker 实时日志显示媒体接口返回 500：`there is no unique or exclusion constraint matching the ON CONFLICT specification`。

数据库的部分唯一索引仅覆盖 `review_id is null and content_sha256 is not null` 的记录，但写入语句的冲突条件只写了 `review_id is null`。两个条件无法匹配，PostgreSQL 因此拒绝写入媒体元数据；前端收到失败结果后清除了临时预览。

## 修复

- `src/worker.ts`：将媒体写入的 `ON CONFLICT` 条件改为与数据库部分唯一索引完全一致的 `review_id is null and content_sha256 is not null`。

## 验证状态

- 已使用真实邀评令牌与本地 PNG 文件完成上传验证，媒体接口成功返回媒体记录 ID。
- 验证后已立即删除测试媒体记录，未影响现有评论数据。
