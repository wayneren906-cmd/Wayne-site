# Wayneo

一个关于学习、实践与日常观察的个人网站。采用独立刊物式排版：暖纸色、黑白摄影、大字号目录与克制的动效。

**[Index](https://wayneo.dev) · [Journal](https://wayneo.dev/learning) · [Studio](https://wayneo.dev/studio)**

更新时间：2026-10-15。网站由公开的个人空间和管理员私人工作台组成。Studio 最新版已发布；本次补充 Journal 英文标题以及 Journal / Studio 入场动画，首页动画保持原样。功能范围见 [Studio 产品定位](docs/studio-functional-plan.md)，发布与验收记录见 [工作台验证](docs/studio-workbench-verification.md)。测试域名当前共用生产 Worker / D1，不能用于隔离写入测试。

## 页面与功能

- **首页**：摄影封面、双页式学习目录、实践入口、影像与联系信息。手机端保留左右构图。
- **学习日志**：Journal 英文封面标题、每日记录、类似 GitHub 贡献图的学习日历、日期与月份筛选、全文搜索和历史快照。
- **项目与实践**：展示 C 语言、嵌入式和汽车电子的探索方向；完整项目内容仍在整理。
- **Studio 公开仪表盘**：成长趋势、近期探索、已发布项目与里程碑、目标和活动档案，以及学习与练习目录。仅展示明确公开的数据。
- **私人工作台**：日常与项目记录新增、修订、历史和删除，项目证据关联、项目及目标草稿管理、发布差异预览、确认发布与撤下，系统状态和账号管理。
- **主题与动效**：支持浅色、深色和系统主题，保存主题选择；Journal 和 Studio 标题、介绍配合轻微上移与渐显入场，Studio 封面摄影淡入。减少动态效果时静态显示。
- **管理与数据**：记录存储在 Cloudflare D1，管理员通过 `/login` 使用邮箱和密码登录。管理权限由服务端会话验证；没有访客注册。
- **学习记录同步**：独立接口支持凭证验证、版本冲突保护和重复提交。详细说明见 [自动学习记录同步](docs/learning-sync.md)。

站点可以独立运行，不需要 ChatGPT 账号。ChatGPT 学习系统接入、自动评估与规划、后台任务执行器、自定义项目和完整记录分页检索尚未完成。加密私人备份与隔离恢复服务已有实现，正式备份密钥、独立检查点存储与保留策略仍待配置和验收。Studio 摄影保留原作与作者来源，网站使用许可尚待核实，详见 [摄影说明](docs/studio-photography.md)。

## 技术栈

| 部分 | 实现 |
| --- | --- |
| 页面 | React 19、Next.js App Router 文件结构 |
| 构建与运行 | Vinext beta、Vite、Cloudflare Workers |
| 样式 | CSS Grid、自定义 CSS、Tailwind CSS |
| 数据库 | Cloudflare D1 / SQLite |
| 管理员登录 | 邮箱与密码、scrypt 密码哈希、服务端会话与 HttpOnly Cookie |
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

如需本地变量，将 `.dev.vars.example` 复制为 `.dev.vars`；变量文件已被 Git 忽略。示例中的 Access 项属于历史配置，当前网站登录不再使用 Access JWT。首位管理员需在独立本地数据库中初始化，不能仅靠设置邮箱变量获得权限；方案生成工具与账号初始化说明见 [邮箱管理员登录](docs/email-login.md)。勿复制生产凭证或私人内容到测试夹具。

若在其他 Cloudflare 账号部署，需要先创建自己的 D1 数据库，并修改 [wrangler.jsonc](wrangler.jsonc) 中的账号、数据库、域名和管理员配置。

## 检查与构建

```bash
pnpm test
pnpm typecheck
pnpm build
```

最近完整验证为 208 项单元测试，覆盖邮箱会话、权限与同源写入、学习日边界、幂等接收、修订删除、备份恢复、项目与目标发布及工作台状态。另有隔离 Worker 路由和合成浏览器流程验证，涵盖四种屏宽和明暗主题，详见 [验证记录](docs/studio-workbench-verification.md)。本次新增标题与动画的类型检查和 CSS 语法检查通过，浏览器视觉效果尚未验收；历史浏览器结果不代表本次动画已验证。

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

发布后检查首页、Journal、Studio 公开栏目与公开记录接口，确认匿名私人页面只展示登录提示、私人 API 返回 401，并验证管理员登录与退出。浏览器测试使用合成身份和隔离数据，避免在生产数据库进行写入测试。

## 管理员与学习日

管理员使用 `/login` 登录，密码以 scrypt 哈希保存，会话令牌只放入安全 Cookie，D1 仅保存令牌摘要。会话有效期 8 小时；退出、账号停用或认证版本变化使旧会话失效。仅 owner 可以添加管理员；所有管理员使用同一 owner 数据空间。没有邮箱发信、密码找回、账号停用或密码修改界面。旧 Access JWT 不提供网站权限，历史登记接口返回 410。完整安全与初始化流程见 [邮箱管理员登录](docs/email-login.md)。

相关配置项：

| 变量 | 用途 |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN`、`CF_ACCESS_AUD`、`JOURNAL_OWNER_EMAIL` | 历史 Access 配置，不作为当前邮箱登录授权依据 |
| `SYNC_TOKEN_SHA256` | 独立同步凭证摘要，保存为 Worker Secret |

学习日以北京时间 **06:00** 为边界。Cloudflare 定时任务在 **23:00** 与次日 **05:55** 保存已有记录的快照，不会读取聊天或生成学习内容。

从学习聊天整理记录的 Codex 定时任务是外部流程，需要电脑开机、应用运行和可用权限。此前学习同步任务已停用，Studio 中的任务状态展示不代表任务执行器或 ChatGPT 同步已接入。

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
| `app/studio/` | 公开仪表盘、栏目与私人工作台 |
| `app/login/`、`lib/admin-auth.ts` | 邮箱登录与管理员会话 |
| `app/site-header.tsx`、`app/site-footer.tsx` | 共享导航、主题和页脚 |
| `app/globals.css` | 基础样式 |
| `app/publication.css` | 首页刊物排版、字体与动效 |
| `app/journal-reading.css` | 日志页阅读样式 |
| `app/studio/studio-editorial.css` | Studio 刊物排版、摄影与入场动画 |
| `app/api/`、`lib/`、`worker/` | 接口、数据、验证与 Worker 逻辑 |
| `migrations/` | D1 数据库迁移 |
| `scripts/`、`tests/` | 导入、导出、同步与测试 |
| `public/` | 图片、图标与本地字体 |

修改后先检查本地效果、测试和构建，再提交发布。多设备协作时先核对远程改动，不要强制推送。

`.dev.vars`、`.env*`、`data/`、运行缓存、依赖与构建产物均不提交。密钥、同步凭证和备份文件不得写入公开仓库。

Roboto 字体许可见 `public/fonts/OFL.txt`。复用或替换其他字体、影像时，应确认各自的授权。
