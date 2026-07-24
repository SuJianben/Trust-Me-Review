# V1 开发店验收清单

1. 使用 Shopify Dev Dashboard 的自定义分发链接，在开发店安装应用。
2. 进入主题编辑器，在商品模板添加 **Trust Me Review rating** 和 **Trust Me Review widget** 区块，填入部署后的 Worker 地址与 Turnstile site key。
3. 打开商品页，确认无评价时出现正式空状态；提交公开评价后，它不显示在前台且后台状态为 `pending`。
4. 在后台发布评论，确认星级徽章、平均分、评论数、移动端显示同步更新；隐藏或删除后再次确认统计回退。
5. 投递履约 webhook；在测试邀评记录中确认延迟任务、测试投递与邀评链接。
6. 用邀评链接提交评价，确认评价为 `pending` 且发布后显示“Verified purchase”。重复使用该链接必须失败。
7. 验证非法 webhook HMAC 返回 401；重新投递同一 webhook ID 不创建重复邀评任务。
8. 卸载应用后，确认店铺状态变为 `uninstalled`；测试 `shop/redact` 后确认状态为 `redacted`。
