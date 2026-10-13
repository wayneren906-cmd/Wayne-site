# wayneo.dev 迁移进度

当前进度：**C2-L 公开 Studio 优化已部署。** 页眉新增 Studio，公开页包含进度统计/最近手记/学习计划/私人入口，只有 studio/private 与私人 API 登录保护。main 提交 3b988c8、Check/Deploy 成功，生产版本 5d7d1ccd-0643-4138-a879-36a2bf20028d；双域名公开 Studio200、私人302，页面资源正常、旧公开 API 哈希不变。138/138、类型/构建/30路由与三视口深浅主题通过。总体粗估55%–60%，本批+2个百分点。详见 [公开 Studio](docs/studio-public-preview.md)。

当前进度：**C2-K Studio 已推送并部署成功。** 用户明确授权后，main 提交 8e043e9，GitHub Check/Deploy 均成功；生产版本 cd3f6cfe-8a22-476b-ac5f-791d26fb190b。Studio Access 四路径保护已更新，匿名入口均跳转登录；两域名公开页面和资源正常、旧公开 API 哈希一致。真实 owner 尚未登记，签名所有者先查看只读预览，私人保存禁用。总体粗估 53%–58%，本批 +3 个百分点。详见 [部署结果](docs/studio-deployment-result.md)。

当前进度：**C2-J Studio 上线准备完成，尚未发布。** 已核对生产 Access/Worker 与空 owner 表，补齐签名身份的只读登记提案入口；不会创建或启用账户。136/136、非增量类型检查、隔离完整构建与 26 个实际 Worker 路由请求通过。代码哈希清单与既有 Access 四路径扩展、版本回退方案已准备；提交推送、生产发布和 Access 修改等待明确授权，真实登记另行授权。详见 [Studio 上线准备](docs/studio-release-readiness.md)。

> 历史记录：以下为2026-10-11迁移时的检查与授权，不能作为现在部署、线上写入或调度的授权。2026-10-13阶段0已重新核对部分后台配置和只读接口；最新现状、未核验项与后续范围见 [架构](docs/architecture.md) 和 [实施计划](docs/implementation-plan.md)。测试域名当前共用生产Worker/DB，不是隔离预览。

更新时间：2026-10-11（北京时间）。域名迁移、GitHub Actions 自动部署和真实聊天摘要写入均已验证完成；每日 06:00 的定时同步已启用，首个定时运行尚待验证。

## 已完成

- 本机源码：D:\codex_dev\web\wayne-site-migration\wayne-site。
- Cloudflare 账户：0a59f37c545599c4f15fcc9e8f53c7bf。
- Worker：wayne-site；正式 https://wayneo.dev，测试 https://study-test.wayneo.dev。
- 2026-10-11 01:29 自动发布版本：9c797e75-e20e-48e2-819d-d0cb912cfe8f，100% 流量；对应 GitHub 提交 10c2ba5，Deploy website 运行 38071905534 成功。
- D1：wayne-learning，badfc253-15a8-4cfa-9e6b-fb6b237c1b93。
- 8 项测试、类型检查、生产构建通过。修复 Workers 不支持 fetch redirect:error 导致管理员验证失败；改为 manual，仍拒绝重定向并验证 JWT 签名和声明。
- Access 应用 Wayne site admin：af090a7a-8aff-4384-a83b-cd532ee3ba07；策略 Wayne site owner：e441c72e-7bd1-401c-96ae-80331f214cf5，只允许所有者邮箱。保护两个域名的 /admin 和 /api/admin/*。关闭 eager_redirect_cookie_setting，避免跨域同步回旧站。
- 正式域名主页、学习页、项目页 HTTP 200；匿名管理员页面和实际管理 API 跳转 Access 登录。本人正式域名登录并读取管理数据成功。
- 测试站原样保存 2026-10-09 既有内容验证写入：revision 3→4，更新时间变化，正文和练习未改动。两天记录和两份快照完整迁移。
- 定时快照：北京时间 23:00、次日 05:55，只保存已有记录，不会读取聊天或生成学习内容。
- 已部署专用 /api/sync/records，提交 3cb60b3，GitHub Deploy website 运行 38111256534 成功，对应版本 e0c6b514-01e5-4225-8960-d92f8f5a0f7e。独立随机令牌只保存在忽略的本机 data；Worker Secret SYNC_TOKEN_SHA256 只保存摘要。
- 已从可见学习聊天整理并新增 2026-10-10 记录，revision=1；回读核对和重复提交通过。17 项测试、类型检查、构建、独立代码审查均通过；匿名/错误凭证 HTTP 401，旧版本写入 HTTP 409，人工管理员仍跳转 Access。原有两条记录和两份快照与同步前备份逐项一致。
- 已启用同聊天 heartbeat wayneo-dev：每天北京时间 06:00 整理前一学习日，只通知真实更新、失败或所需操作。此为本机任务，需要电脑开机且 Codex 运行；首次定时执行的结果需单独核验，不能用首次手动同步替代。
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
- pre-sync-2026-10-11.json、post-sync-2026-10-11.json：首次聊天同步前后备份；sync-evidence-2026-10-10.json 为已读取片段的依据，sync-source-state.json 保存来源检查点。不是完整聊天归档。

## 仍需完成

- 首个每日 06:00 定时运行尚待验证；当前只承诺已核实的两条指定学习聊天。检索不完整时明确覆盖范围，不删除既有内容，不把学习计划记为完成练习。人工修改导致版本变化时停止自动覆盖。其他学习聊天须用户指定后再加入。
- 本机 Git 已关联公开仓库 https://github.com/wayneren906-cmd/Wayne-site 的 main，完整源码已推送，保留原初始化提交。Cloudflare 已连接 main，构建配置、Node 24 和 pnpm 11.25.0 已保存；此前自动构建 API 返回 12052 账户限制，需联系 Cloudflare 支持解决。使用真实 script tag f4222014ba2b4ca6ba0876456a10bc27 重新查询，确认构建配置和 main 触发器仍存在，当前没有构建记录；不能将使用 Worker 名称查询得到的 12040 当作配置不存在或限制仍生效的新证据。
- GitHub Actions 推送 main 和手动部署均已启用并验证成功。此前提交 d365a33 的部署缺少 Secrets；最新提交 10c2ba5 的 Check 运行 38071905567 和 Deploy website 运行 38071905534 均成功，Cloudflare 发布时间与运行一致。正式主页、学习页、项目页、记录和快照 API 均 HTTP 200，记录数 2；匿名 /admin 和 /api/admin/records 均 HTTP 302 跳转 Access 登录。
- 当前 Cloudflare MCP 授权可读取 Worker 与 Builds 配置，但账户 API Token 管理接口返回 9109 Unauthorized；无法通过此连接创建专用 CI 令牌。不要提取本机 OAuth 登录令牌替代，不要把任何令牌写进聊天或文档。GitHub 现有授权已确认有本仓库 admin/push 权限，无需重复要求用户登录 GitHub 才能读取部署日志。
- Workers Builds 部署令牌权限已收紧为账户内 Workers Scripts/D1 编辑与 wayneo.dev 的 Workers Routes 编辑、Zone 读取，不授予其他产品或其他域名权限。令牌仅保存在 Cloudflare。
- 测试域名保留供后续验证。

## 后续本机部署

使用项目已有 Node/pnpm 和固定依赖。修改后测试、类型检查、构建，再运行 node node_modules/wrangler/bin/wrangler.js deploy。Vite 生成 dist/server/wrangler.json，修改配置应编辑源 wrangler.jsonc。

当前授权需使用能读取已完成 Cloudflare OAuth 的权限环境；普通沙箱 whoami 的未登录输出不能据此判断授权失效。不要输出令牌。设置 WRANGLER_SEND_METRICS=false 和 WRANGLER_LOG_PATH 到项目 .wrangler/migration.log，避免写受限全局日志目录。

源码不含令牌，data、.dev.vars、缓存和构建结果不得上传公开仓库。内容恢复需要人工核对，不能覆盖迁移后更新的记录。
