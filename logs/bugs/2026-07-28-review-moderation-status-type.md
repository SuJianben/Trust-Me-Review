# 2026-07-28｜评论审核发布 SQL 类型冲突

## 状态

已修复，待开发店真实链路复验。

## 复现条件

商家后台对状态为 `pending` 的评论点击 Publish、Hide 或 Delete。

## 影响

审核接口返回 500，评论维持原状态，不会被错误发布或删除。

## 根因

审核更新 SQL 中的第一个参数同时用于 `review_status` 枚举赋值和文本字面量比较。PostgreSQL 无法推导该参数的唯一类型，报错 `inconsistent types deduced for parameter $1`。

## 修复

将状态参数与状态字面量显式转换为 `review_status`，并将该 SQL 拆成可读的多行语句，避免后续改动时遗漏类型约束。

## 验证标准

对待审核评论点击 Publish 后：后台状态变为 `published`，前台评分和评论列表同步更新。
