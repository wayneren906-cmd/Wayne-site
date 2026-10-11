# Wayne 的个人网站

这是已部署到自己 Cloudflare 账号的完整源码。主页、学习日历、记录编辑、数据库和定时快照都可以独立运行，无需 ChatGPT 账号。内容更新通过站点的 /admin；GitHub main 推送后通过 GitHub Actions 自动发布到 Cloudflare，2026-10-11 已验证成功。

## 当前交付状态

- 独立源码、数据库迁移、管理员验证、定时快照和 GitHub 检查配置已准备。
- 2026-10-10 已部署到个人 Cloudflare，正式域名 https://wayneo.dev 已切换；旧 ChatGPT Sites 已解绑域名并限制为所有者访问。
- 数据库与 Access 已配置；正式域名管理员登录、测试域名原样保存、匿名访问保护已验证。8 项测试、类型检查和生产构建通过。
- 两天学习记录和两份历史快照已迁移，本机备份保存在 data。2026-10-11 已接入独立同步接口并核对一次真实更新：新增 10 月 10 日记录，重复提交无变化，原有内容和快照保留。
- Codex 已配置每天北京时间 06:00 从指定学习聊天整理刚结束的学习日。本机运行需要电脑开机且应用运行；首个定时运行尚待验证。详细流程见 [自动同步说明](docs/learning-sync.md)。
- 历史数据包只作为迁移附件，不提交到 GitHub。上线切换前需要再次导出最新数据。
- 当前采用 Vinext beta，固定了已验证的依赖版本。升级前在测试站验证。

## 1. 保存到 GitHub

本目录已关联公开仓库 https://github.com/wayneren906-cmd/Wayne-site，使用 main 分支并保留仓库原有初始化提交。历史学习数据、密钥和运行缓存不提交到仓库。

源码包含 .github/workflows 和 .dev.vars.example；node_modules、dist、data、.dev.vars 和令牌不上传。本源码包没有 GitHub 和 Cloudflare 密钥。

后续在本目录修改源码后提交：

```bash
git add .
git commit -m "Update website"
git push
```

不要强制推送；多人或多设备更新时先同步远程变更。

## 2. 创建自己的数据库并首次部署

安装 Node.js 24 和项目 packageManager 指定的 pnpm，执行：

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler d1 create wayne-learning
```

将输出的 database_id 替换到 wrangler.jsonc。保持绑定名称为 DB。提交配置更新，然后：

```bash
pnpm test
pnpm typecheck
pnpm deploy
```

pnpm deploy 会构建、应用数据库迁移、部署 Worker。第一次先使用 Cloudflare 返回的 workers.dev 地址，不动当前域名。

## 3. 配置独立管理员登录

在 Cloudflare Zero Trust 选择团队名称，启用邮箱一次性验证码。创建 Self-hosted Access 应用，将新站域名下的 /admin 和 /api/admin/* 加入同一应用，Include 策略只允许你的邮箱。避免设置 Bypass 策略。请配置自己的域名测试站（例如 study-test.wayneo.dev），将 Worker 自定义域名和 Access 应用同时设置为此域名；未保护的 workers.dev 地址也会由源码拒绝无凭证写入。

填写 wrangler.jsonc 的 vars：

| 变量 | 值 |
| --- | --- |
| CF_ACCESS_TEAM_DOMAIN | https://你的团队名.cloudflareaccess.com |
| CF_ACCESS_AUD | 该 Access 应用的 Application Audience (AUD) |
| JOURNAL_OWNER_EMAIL | 允许管理的邮箱 |

团队地址和 AUD 是配置标识，不是登录密钥。登录凭证由 Access 签名，源码验证签名、应用、有效期和所有者邮箱。保存配置并重新部署。打开测试域名 /admin，使用邮箱验证码登录，创建一条真实测试记录；刷新公开 /learning 验证可见。未登录访客的写请求必须失败。测试记录不要编造学习进度，可使用真实内容。

## 4. 迁移历史学习记录

解压附件中的 migration/learning-export.json。可重新从旧站导出：

```bash
pnpm export:data https://wayneo.dev data/learning-export.json
pnpm import:sql data/learning-export.json data/import.sql
pnpm exec wrangler d1 execute DB --remote --file data/import.sql
```

导入只添加不存在的日期，保留 revision、更新时间和历史快照；已存在日期不会覆盖。若新库同日期已有内容，应逐项比较并在管理页合并。SQL 文件不要提交仓库。先将记录数、日期、内容、版本和快照与旧站核对。

## 5. GitHub 更新后自动部署

已在 Cloudflare Workers & Pages 为 wayne-site 连接 GitHub Wayne-site 仓库，生产分支 main，构建命令 pnpm test && pnpm typecheck && pnpm build，部署命令 pnpm db:remote && pnpm exec wrangler deploy --config dist/server/wrangler.json。Build variables 为 NODE_VERSION=24、PNPM_VERSION=11.25.0。Cloudflare API 返回 12052：账户被禁止使用 Workers Builds；该路径尚未完成自动发布验证。预览构建关闭。

部署令牌仅存于 Cloudflare Workers Builds，权限限于个人账户的 Workers Scripts 编辑、D1 编辑，以及 wayneo.dev 的 Workers Routes 编辑和 Zone 读取。令牌不写入本机源码、仓库或聊天。

仓库已启用 GitHub Actions：推送 main 或手动运行 Deploy website 都会触发部署，工作流使用 production environment。2026-10-11 北京时间 01:29，提交 10c2ba5 的检查和部署均成功：[部署运行](https://github.com/wayneren906-cmd/Wayne-site/actions/runs/38071905534)。Cloudflare 发布版本为 9c797e75-e20e-48e2-819d-d0cb912cfe8f，流量 100%；正式站页面、公开数据与匿名管理员登录保护已于当天再次验证。

此前因缺少 CLOUDFLARE_API_TOKEN 失败的问题已解决。工作流使用 GitHub 加密 Secrets 中的 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID；更换令牌时使用目标账户的 Workers Scripts 编辑、D1 编辑，以及 wayneo.dev 区域的 Workers Routes 编辑和 Zone 读取权限。

令牌只保存到 GitHub 的加密 Secrets，不要写进源码、提交、日志或聊天，也不要使用本机 OAuth 登录令牌替代长期 CI 部署令牌。保存后手动运行 Deploy website，核对运行成功、新的 Worker 发布版本及正式站访问，才能确认自动部署可用。Cloudflare Workers Builds 的仓库关联配置仍然存在，不能使用 Worker 名称代替系统生成的 script tag 查询后据此判断配置丢失；该路径之前返回的 12052 账户限制仍待解决，无需同时运行两套自动部署。

## 6. 最后切换 wayneo.dev

确认新站页面、登录、写入、历史数据和快照正常后：
1. 暂停旧站的数据写入，再导出并核对一次最新记录。
2. 在旧 Sites 解绑自定义域名；保留原平台地址和数据以便回退。
3. 移除旧 @ CNAME 的 custom-domains.chatgpt.site 指向，在自己的 Worker 设置中添加自定义域名 wayneo.dev，由 Cloudflare 创建对应记录和证书。
4. 将 Access 应用域名同步调整到 wayneo.dev，确认 /admin 和 /api/admin/* 都受保护。
5. 测试手机、桌面、访客只读、管理员编辑和退出登录。
6. 独立快照运行通过后，关闭旧站的定时写入任务，避免两边记录分叉。

不要修改已有 blog.wayne.kdns.fr Worker 或 cqupt.wayne.kdns.fr A 记录。无需为新站设置网址跳转。

## 日常维护

- 写学习内容：打开 /admin，邮箱验证码登录，点记一笔或编辑。保存后立即写入 D1，无需改代码。
- 改简介或项目：编辑 app/personal-home.tsx、app/projects/page.tsx；改样式：app/globals.css。推送到 GitHub main 后由 GitHub Actions 自动部署到 Cloudflare。
- 快照：北京时间 23:00 和次日 05:55，保存已有记录。06:00 切换学习日。快照在同一数据库，不能代替异地备份。
- 备份：定期运行 pnpm export:data，将 JSON 保存到自己的电脑或可信存储。D1 数据备份恢复也应按 Cloudflare 官方文档操作。
- 检查：GitHub Actions 查看构建结果，Cloudflare Logs 查看 Worker 错误和定时任务执行情况。
- 恢复页面：回退 GitHub 提交并重新部署。恢复内容需要备份文件和人工核对，不应覆盖更新后的记录。
- 学习聊天摘要由 Codex 每天北京时间 06:00 整理并通过独立凭证写入；网站自身的定时任务负责快照。没有新证据时不生成记录，人工修改版本时停止覆盖并报告。日常也可直接在 /admin 写记录，无需等待自动任务。

## 官方参考

- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/workers/ci-cd/builds/
