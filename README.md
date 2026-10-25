# Wayneo

一个关于学习、实践与日常观察的个人网站。采用独立刊物式排版：暖纸色、黑白摄影、大字号目录与克制的动效。

**[Index](https://wayneo.dev) · [Journal](https://wayneo.dev/learning) · [Studio](https://wayneo.dev/studio)**

更新时间：2026-10-16。纯展示站已正式发布：首页恢复氛围式叙事与 Studio 入口，Studio 项目索引、独立 Wayneo 详情与收藏馆均已上线，Journal 保留只读浏览。全站搜索已取消，旧搜索链接返回 Studio。内容在站外整理确认后随网站更新，工具内容仍待确认。发布及验收见 [验证记录](docs/studio-workbench-verification.md)，总体方案见 [产品定位](docs/studio-functional-plan.md)。测试域名当前共用生产 Worker / D1，不能用于隔离写入测试。

## 页面与功能

- **首页 Index**：个人封面、近期手记、案头实践入口、影像与联系，恢复原来的刊物式叙事。案头保留「让想法，有迹可循。」与唯一 Studio 入口，不在首页展示具体项目名称、摘要、标签或详情链接；近期手记沿用最近三条公开记录与双页目录。手机端保留左右构图。
- **学习日志**：Journal 英文封面标题、每日记录、类似 GitHub 贡献图的学习日历、日期与月份筛选、全文搜索和历史快照。
- **Studio 项目展示**：主界面只放简短项目介绍与详情入口，保留摄影与封面。Wayneo 完整特稿位于 `/studio/wayneo`，四段内容、页面截图与版式体验集中在详情页，提供返回 Studio 的链接。旧管理与方向目录地址仍跳转至 Studio。
- **收藏馆**：`/studio/collection` 按故事世界、剧集、游戏浏览五项已确认兴趣：冰与火之歌、绝命毒师、权力的游戏、最后生还者、CS2。保留中英文作品名、简短介绍和官方来源；没有评分、观看进度、海报盗链或内容输入。Studio 只放简短入口。
- **纯展示边界**：Journal 不再提供录入、登录或编辑；旧管理/登录页面在服务器入口跳转，站内内容编辑和账号管理写入请求返回 405。旧代码与数据保留，外部同步、退出登录清理及定时快照没有一刀切停用。
- **主题与动效**：支持浅色、深色和系统主题，保存主题选择；Journal 和 Studio 标题、介绍配合轻微上移与渐显入场，Studio 封面摄影淡入。减少动态效果时静态显示。
- **内容与数据**：项目文案在 `content/wayneo.ts`，收藏内容在 `content/collection.ts`，新公开手记入口为 `content/journal.ts`（尚无新增材料，保持空数组）。统一公开读取层合并本地项目/手记和 D1 原有公开 records；公开数据不含私人记录、草稿和备注。收藏页无需读取数据库。每条手记只维护一个来源，重复日期显式报错。
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

### 目录与图片存放

网站源码根目录是 `wayne-site-migration/wayne-site/`，外层 `web/` 是工作区。

| 位置（相对源码根目录） | 用途 |
| --- | --- |
| `app/`、`lib/`、`content/`、`worker/` | 页面、业务逻辑、展示内容与 Worker 入口 |
| `public/` | 网站正式静态资源；根目录的 `editorial-*.jpg`、Logo 和图标已有公开 URL，移动时需同步引用 |
| `public/studio-photography/` | Studio 摄影与 `credits.json` 来源记录 |
| `public/project-case/` | 项目详情页使用的正式案例截图，需要随源码维护 |
| `public/fonts/` | 字体与许可文件 |
| `artifacts/screenshots/workspace/` | 从外层工作区归拢的 `shot_*.png` 调试截图，仅本地保留 |
| `artifacts/screenshots/site-root/` | 从源码根目录归拢的 `screenshot*.png` 调试截图，仅本地保留 |
| `tests/.generated/` | 测试运行器生成的截图、日志与临时夹具，仅本地保留 |
| `docs/`、`migrations/`、`scripts/`、`tests/` | 项目文档、数据库迁移、维护脚本与测试 |
| `data/` | 本地数据、备份与预览材料，已忽略，不放入公开资源 |
| `../../drafts/` | 外层工作区的工具配置提案与界面草案，不是生效配置 |
| `../migration/` | 历史迁移数据，保留在仓库之外 |

新调试截图放在 `artifacts/screenshots/` 的对应子目录，自动化测试继续使用 `tests/.generated/`。不要把调试截图放进 `public/`；正式项目案例图仍放在 `public/project-case/`。此次归拢保留了全部原文件，原路径、目标路径和 SHA256 校验值见本地 `artifacts/move-manifest.json`。

`node_modules/`、`.next/`、`dist/`、`.wrangler/`、`.pnpm-store/`、`.pnpm-cache/` 是依赖、构建或工具生成目录，已被 Git 忽略。整理目录时无需搬动它们。

### 启动开发服务

推荐 Node.js 24。项目指定 pnpm 11.25.0。

```bash
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

默认本地地址为 `http://localhost:5173`。首次启动的本地数据库可能为空，正式站的数据不会自动复制到本地。

隔离构建后，可用 `node tests/studio-project-preview-server.mjs --display --records <本地公开接口快照路径>` 预览现有公开日志。快照必须为 `/api/records` 的公开响应，仅装入临时内存数据库；不复制到 `content/` 或公开资源，也不连接生产数据库。省略 `--records` 时预览数据库为空。

如需本地变量，将 `.dev.vars.example` 复制为 `.dev.vars`；变量文件已被 Git 忽略。示例中的 Access 项属于历史配置，当前网站登录不再使用 Access JWT。首位管理员需在独立本地数据库中初始化，不能仅靠设置邮箱变量获得权限；方案生成工具与账号初始化说明见 [邮箱管理员登录](docs/email-login.md)。勿复制生产凭证或私人内容到测试夹具。

若在其他 Cloudflare 账号部署，需要先创建自己的 D1 数据库，并修改 [wrangler.jsonc](wrangler.jsonc) 中的账号、数据库、域名和管理员配置。

## 检查与构建

```bash
pnpm test
pnpm typecheck
pnpm build
```

最近本地验证为 232 项单元测试；类型检查、隔离完整构建及 Journal 真实 Chrome 定向验收通过。阅读区覆盖四种屏宽与明暗主题，另有手机和桌面归档布局，共 10 张截图，并检查原文字保留、两倍字号、移除目录和操作栏、日期筛选、历史快照及失败重试。归档检查覆盖最近七次、跨年月份分组、无 JavaScript 的键盘展开、历史正文搜索和快照身份。定向运行命令为 `node tests/display-site-browser.mjs --journal-only`，完整展示站回归入口仍为 `tests/display-site-runtime.mjs`、`tests/display-site-browser.mjs`；旧工作台运行器保留作历史参考。线上发布验证另见 [验证记录](docs/studio-workbench-verification.md)。

Journal 服务端首屏直接输出公开记录并应用日期、月份和关键词筛选；日期地址保留对应的标题、摘要与分享信息，历史地址保留快照日期。初次读取失败可重试，后续更新失败保留已读正文；切换快照失败不会显示上一份内容。额外运行时检查见 `node tests/journal-reading-runtime.mjs`；浏览器回归包含关闭 JavaScript、无重复首屏请求、前进后退与刷新、历史快照切换和错误恢复。全部本地验证使用隔离内存 D1 与合成材料，不写入生产；线上结果需以实际发布验收为准。

阅读方案采用大留白、大标题：版心居中、文字左对齐，第一节标题位于阅读画面中部，淡章节数字置于标题附近。正文按句号与分号分成短段，原文字、标点、空行和成绩逐字保留。篇内目录、记录链接与复制操作栏、代码灰框和逐节横线已移除；日期阅读页仍提供实际存在的相邻记录链接，历史阅读保留快照身份。截图对应的既有公开手记只用于临时内存预览，没有写回网站或内容文件。

默认日期索引保留最近七次的大日期与主题摘要，更早的记录按年月折叠；展开后只列精简日期与主题，点日期进入正文。同月中已展示的最近记录不在归档内重复。指定日期、月份筛选及搜索覆盖全部匹配记录，不受七次限制；历史快照沿用同一规则，日期链接保留快照身份。

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
