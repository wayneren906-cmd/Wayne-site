# Wayneo

一个关于学习、实践与日常观察的个人网站。采用独立刊物式排版：暖纸色、黑白摄影、大字号目录与克制的动效。

**[访问网站](https://wayneo.dev) · [学习日志](https://wayneo.dev/learning) · [项目与实践](https://wayneo.dev/projects)**

## 页面与功能

- **首页**：摄影封面、双页式学习目录、实践入口、影像与联系信息。手机端保留左右构图。
- **学习日志**：完整的每日记录、类似 GitHub 贡献图的学习日历、日期与月份筛选、全文搜索和历史快照。
- **项目与实践**：展示 C 语言、嵌入式和汽车电子的探索方向；完整项目内容仍在整理。
- **主题与动效**：支持浅色、深色和系统主题，保存主题选择；为减少动态效果的用户提供静态显示。
- **管理与数据**：记录存储在 Cloudflare D1，管理员通过 Cloudflare Access 登录，在 `/admin` 编辑。
- **学习记录同步**：独立接口支持凭证验证、版本冲突保护和重复提交。详细说明见 [自动学习记录同步](docs/learning-sync.md)。

站点可以独立运行，不需要 ChatGPT 账号。摄影栏目目前包含标注为版式参考的影像。

## 技术栈

| 部分 | 实现 |
| --- | --- |
| 页面 | React 19、Next.js App Router 文件结构 |
| 构建与运行 | Vinext beta、Vite、Cloudflare Workers |
| 样式 | CSS Grid、自定义 CSS、Tailwind CSS |
| 数据库 | Cloudflare D1 / SQLite |
| 管理员登录 | Cloudflare Access、服务端 JWT 验证 |
| 发布 | GitHub Actions → Cloudflare Workers |

具体依赖版本以 [package.json](package.json) 和锁文件为准。Vinext 目前使用 beta 版本，升级依赖前应先验证测试和构建。

## 本地运行

推荐 Node.js 24。项目指定 pnpm 11.25.0。

```bash
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

默认本地地址为 `http://localhost:5173`。首次启动的本地数据库可能为空，正式站的数据不会自动复制到本地。

如需测试管理员配置，将 `.dev.vars.example` 复制为 `.dev.vars`，填写对应的 Access 配置。本地变量文件已被 Git 忽略；仅填写变量不能代替真实的 Access 登录凭证。

若在其他 Cloudflare 账号部署，需要先创建自己的 D1 数据库，并修改 [wrangler.jsonc](wrangler.jsonc) 中的账号、数据库、域名和管理员配置。

## 检查与构建

```bash
pnpm test
pnpm typecheck
pnpm build
```

现有 17 项测试覆盖管理员身份验证、同源写入、学习日边界、数据导入、快照与同步版本保护。排版、字体和动效仍需在浏览器中检查，尤其是手机端。

Windows 下若运行中的本地服务占用了 `dist/server/.wrangler`，默认构建清理可能报 `EPERM`。可以先停止相关本地服务，再重新构建；也可在本地使用以下命令保留输出目录进行构建检查：

```bash
pnpm build --emptyOutDir false
```

正式 CI 使用干净的构建环境。

## 发布到 Cloudflare

仓库的生产分支为 `main`。推送到 `main` 后，[Deploy website 工作流](.github/workflows/deploy.yml) 会执行安装依赖、测试、类型检查、构建、数据库迁移和部署。也可以在 GitHub Actions 中手动运行该工作流。

GitHub 的 `production` Environment 需要配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

令牌应仅具备部署此 Worker、访问对应 D1 数据库及绑定域名所需的权限，保存在 GitHub Secrets 中。

使用自己的本机 Cloudflare 登录进行发布：

```bash
pnpm exec wrangler login
pnpm deploy
```

`pnpm deploy` 会构建项目、应用远程数据库迁移并部署生成的 `dist/server/wrangler.json`。配置变更应修改源文件 `wrangler.jsonc`，不要直接编辑生成文件。

发布后检查首页、学习日志、项目页和公开记录接口，并确认匿名访问 `/admin` 与 `/api/admin/*` 仍进入 Access 验证。

## 管理员与学习日

Cloudflare Access 应保护 `/admin` 和 `/api/admin/*`，策略仅允许站点所有者。源码还会验证 JWT 签名、应用 Audience、Issuer、有效期和所有者邮箱。

相关配置项：

| 变量 | 用途 |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | Access 团队地址 |
| `CF_ACCESS_AUD` | Access 应用 Audience |
| `JOURNAL_OWNER_EMAIL` | 站点所有者邮箱 |
| `SYNC_TOKEN_SHA256` | 独立同步凭证摘要，保存为 Worker Secret |

学习日以北京时间 **06:00** 为边界。Cloudflare 定时任务在 **23:00** 与次日 **05:55** 保存已有记录的快照，不会读取聊天或生成学习内容。

从学习聊天整理记录的 Codex 定时任务是外部流程，需要电脑开机、应用运行和可用权限；它不属于网站服务器自身的能力。

## 数据备份与导入

导出公开学习记录和历史快照：

```bash
pnpm export:data https://wayneo.dev data/learning-export.json
pnpm import:sql data/learning-export.json data/import.sql
```

核对导出内容后，可以导入本地数据库：

```bash
pnpm exec wrangler d1 execute DB --local --file data/import.sql
```

远程恢复时显式使用 `--remote`，并先备份、核对目标数据库。导入只添加不存在的日期，不覆盖已有内容，保留记录版本、更新时间和历史快照。数据库内的快照不能替代独立备份。

## 目录与维护

| 路径 | 内容 |
| --- | --- |
| `app/personal-home.tsx` | 首页与联系区 |
| `app/journal.tsx`、`app/activity-calendar.tsx` | 日志阅读、编辑与学习日历 |
| `app/projects/page.tsx` | 项目方向展示 |
| `app/site-header.tsx`、`app/site-footer.tsx` | 共享导航、主题和页脚 |
| `app/globals.css` | 基础样式 |
| `app/publication.css` | 首页刊物排版、字体与动效 |
| `app/journal-reading.css` | 日志页阅读样式 |
| `app/api/`、`lib/`、`worker/` | 接口、数据、验证与 Worker 逻辑 |
| `migrations/` | D1 数据库迁移 |
| `scripts/`、`tests/` | 导入、导出、同步与测试 |
| `public/` | 图片、图标与本地字体 |

修改后先检查本地效果、测试和构建，再提交发布。多设备协作时先核对远程改动，不要强制推送。

`.dev.vars`、`.env*`、`data/`、运行缓存、依赖与构建产物均不提交。密钥、同步凭证和备份文件不得写入公开仓库。

Roboto 字体许可见 `public/fonts/OFL.txt`。复用或替换其他字体、影像时，应确认各自的授权。
