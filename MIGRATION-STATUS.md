# wayneo.dev 迁移进度

更新时间：2026-10-10。域名迁移已完成，GPT 定时内容写入尚未接入。

## 已完成

- 本机源码：D:\codex_dev\web\wayne-site-migration\wayne-site。
- Cloudflare 账户：0a59f37c545599c4f15fcc9e8f53c7bf。
- Worker：wayne-site；正式 https://wayneo.dev，测试 https://study-test.wayneo.dev。
- 当前发布版本：836e2c03-31e9-4a45-b69b-69e049c9ee04。
- D1：wayne-learning，badfc253-15a8-4cfa-9e6b-fb6b237c1b93。
- 8 项测试、类型检查、生产构建通过。修复 Workers 不支持 fetch redirect:error 导致管理员验证失败；改为 manual，仍拒绝重定向并验证 JWT 签名和声明。
- Access 应用 Wayne site admin：af090a7a-8aff-4384-a83b-cd532ee3ba07；策略 Wayne site owner：e441c72e-7bd1-401c-96ae-80331f214cf5，只允许所有者邮箱。保护两个域名的 /admin 和 /api/admin/*。关闭 eager_redirect_cookie_setting，避免跨域同步回旧站。
- 正式域名主页、学习页、项目页 HTTP 200；匿名管理员页面和实际管理 API 跳转 Access 登录。本人正式域名登录并读取管理数据成功。
- 测试站原样保存 2026-10-09 既有内容验证写入：revision 3→4，更新时间变化，正文和练习未改动。两天记录和两份快照完整迁移。
- 定时快照：北京时间 23:00、次日 05:55，只保存已有记录，不会读取聊天或生成学习内容。
- 旧 Sites 项目 appgprj_6ac9413994dc819192006314205b9946 已解绑 wayneo.dev，list_custom_domains 返回空。旧站 access_mode=custom，只有所有者，revision=3；保留旧数据供恢复。
- 用户确认删除两条旧 A 记录后已移除，Worker 自定义域名绑定成功。

## 本机备份和证据

以下 data 文件已忽略，不上传 GitHub。

- final-before-unbind.json：解绑前旧站最新备份，2 条记录、2 份快照。
- dns-before-cutover.txt：旧 DNS 配置快照，原 A 为 172.66.3.26 和 162.159.143.30，代理开启、TTL Auto。
- admin-write-verified.json：验证保存后的新站数据；与旧备份正文、快照一致，只有已测试记录的 revision 和 updatedAt 增加。
- production-verified.json：正式域名完整记录和快照，与 admin-write-verified.json 完全一致。
- production-admin-verified.jpg：正式域名管理员页面截图。
- pre-migration-2026-10-10.json/sql：最初备份和只添加缺失日期的导入文件。

## 仍需完成

- 定位用户现有 GPT 定时任务所在对话、任务指令和时间，确认可用连接工具，接入独立站的认证写入通道并验证一次真实更新。旧 Sites 关联 automations 为空，不能据此判断其他对话没有任务。不要宣称已自动整理聊天。
- 本机 Git 已关联公开仓库 https://github.com/wayneren906-cmd/Wayne-site 的 main，完整源码已推送，保留原初始化提交。Cloudflare Workers Builds 已连接 main，首次推送部署待验证。构建执行测试、类型检查和生产构建，发布前应用 D1 迁移；NODE_VERSION=24、PNPM_VERSION=11.25.0，关闭预览构建。
- Workers Builds 部署令牌权限已收紧为账户内 Workers Scripts/D1 编辑与 wayneo.dev 的 Workers Routes 编辑、Zone 读取，不授予其他产品或其他域名权限。令牌仅保存在 Cloudflare。
- 测试域名保留供后续验证。

## 后续本机部署

使用项目已有 Node/pnpm 和固定依赖。修改后测试、类型检查、构建，再运行 node node_modules/wrangler/bin/wrangler.js deploy。Vite 生成 dist/server/wrangler.json，修改配置应编辑源 wrangler.jsonc。

当前授权需使用能读取已完成 Cloudflare OAuth 的权限环境；普通沙箱 whoami 的未登录输出不能据此判断授权失效。不要输出令牌。设置 WRANGLER_SEND_METRICS=false 和 WRANGLER_LOG_PATH 到项目 .wrangler/migration.log，避免写受限全局日志目录。

源码不含令牌，data、.dev.vars、缓存和构建结果不得上传公开仓库。内容恢复需要人工核对，不能覆盖迁移后更新的记录。
