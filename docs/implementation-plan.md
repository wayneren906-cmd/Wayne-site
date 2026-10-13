# Wayneo 渐进升级实施计划

当前进度：**C2-L 公开 Studio 优化已部署。** 页眉新增 Studio，公开页包含进度统计/最近手记/学习计划/私人入口，只有 studio/private 与私人 API 登录保护。main 提交 3b988c8、Check/Deploy 成功，生产版本 5d7d1ccd-0643-4138-a879-36a2bf20028d；双域名公开 Studio200、私人302，页面资源正常、旧公开 API 哈希不变。138/138、类型/构建/30路由与三视口深浅主题通过。总体粗估55%–60%，本批+2个百分点。详见 [公开 Studio](studio-public-preview.md)。

当前进度：**C2-K Studio 已推送并部署成功。** 用户明确授权后，main 提交 8e043e9，GitHub Check/Deploy 均成功；生产版本 cd3f6cfe-8a22-476b-ac5f-791d26fb190b。Studio Access 四路径保护已更新，匿名入口均跳转登录；两域名公开页面和资源正常、旧公开 API 哈希一致。真实 owner 尚未登记，签名所有者先查看只读预览，私人保存禁用。总体粗估 53%–58%，本批 +3 个百分点。详见 [部署结果](studio-deployment-result.md)。

当前进度：**C2-J Studio 上线准备完成，尚未发布。** 已核对生产 Access/Worker 与空 owner 表，补齐签名身份的只读登记提案入口；不会创建或启用账户。136/136、非增量类型检查、隔离完整构建与 26 个实际 Worker 路由请求通过。代码哈希清单与既有 Access 四路径扩展、版本回退方案已准备；提交推送、生产发布和 Access 修改等待明确授权，真实登记另行授权。详见 [Studio 上线准备](studio-release-readiness.md)。

更新：2026-10-14，Asia/Shanghai。

当前进度：**C2-I生产数据库四项迁移已完成。** 用户明确“确认”授权仅wayne-learning的0002–0005及ledger；执行前重核schema/文件hash/账号绑定、刷新备份恢复，四项API全部成功。生产9私人表0行、ledger0001–0005、schema与演练一致/FK正常；旧4日志/5快照逐值相同，五个公开页面/接口HTTP200。尚未部署新Worker、登记owner/grant、导入私人或接ChatGPT；备份策略与真实接入仍待后续范围授权。详见[生产迁移结果](database-migration-result.md)。以下为此前批次历史状态。

当前进度：**C2-H数据库上线准备完成，生产迁移待明确授权。** 只读确认生产wayne-learning只有records/snapshots，ledger0001、4日志/5快照；没有新私人表。备份旧公开应用数据并隔离恢复核对通过；新增迁移漂移/前缀/hash预检，SQLite和内存D1证明4项迁移保留旧值、9表为空、失败文件DDL/ledger回滚并可接续。130/130与非增量类型检查通过。拟仅执行0002–0005及ledger，不部署/建用户/导入私人/改权限调度；还未做线上DDL。详见[数据库上线准备](database-migration-readiness.md)。以下历史批次保留。

当前进度：**C2-G 加密私人导出与原子隔离恢复服务已完成。** owner-only同快照导出、AES-GCM备份/独立检查点、空目标导入、删除过滤/高水位及owner停用/grant撤销/旧任务清除已实现；126/126、非增量类型检查、内存D1的22种失败注入与完整恢复核对通过。属于本地可信离线服务；尚未配置密钥/独立检查点存储/保留策略、操作入口或定时生产备份，真实私人导入仍禁止。C2-F完整Worker闭环保留；下一步继续准备真实远程接入和备份操作方案，线上资源/权限/费用/调度仍需明确授权。详见[私人备份](private-backup.md)。以下为此前批次历史口径。

当前进度：**C2-F 完整Worker构建、路由及Chrome/D1本地闭环已完成。** 隔离5阶段完整应用构建成功；生成Worker在workerd中验证23个请求，页面保护、保存/重放/回读/纠正/历史/context/删除、跨源/超大/旧CAS、公开接口隔离及停用/member拒绝通过。Chrome完整SSR/资源/客户端→实际Vinext路由→内存D1通过，三个视口/键盘/减少动画通过；117/117、非增量类型检查通过。下一步为独立远程资源与真实Access/ChatGPT/手机接入（需明确授权），备份保留策略/完整私人导入仍未完成。未部署或提交推送。详见[完整Worker验证](studio-worker-verification.md)。以下C2-E/C2-D/C2-C保持历史口径。

当前进度：**C2-E Studio页面与本地浏览器/API闭环已交付。** 完整回执/DTO校验、同步提交锁、单次context/过期响应保护、错误留稿/原键重试、受保护页面源码已实现。117/117与非增量类型检查通过；Chrome独立合成HTTP/SQLite链路及320/390/1280、Tab焦点、Escape/返回焦点、减少动画通过。未验证完整Vinext Worker构建/路由派发、真实Access与手机，未部署。下一批为隔离完整框架验证；真实私人导入仍受备份/保留策略与真实身份门槛限制。详见[Studio本地验证](studio-local-verification.md)。下方C2-D/C2-C段落保留历史口径。

最新进度：**C2-D 本地删除安全与隔离恢复过滤已交付。** owner-only DELETE、CAS、无正文标记/键、全部修订/回执/任务清理、create/correct 防复活与读取屏蔽已实现。全套112/112、非增量类型检查与内存 D1 检查通过。下一批为受保护 Studio 本地闭环。恢复检查点独立存储/保留策略、完整私人导入和真实接入尚未验收，仍禁止真实私人导入；未部署或提交推送。详见 [删除与恢复](private-deletion.md)。下文 C2-C 状态及“删除准备”表述保留为历史记录，以本段为当前状态。

目标：保留现有网站，先建立可靠的私人学习数据闭环，再验证实际 ChatGPT 接入，最后逐步加入规划与自动运行。架构、数据契约和审计依据见 [architecture.md](architecture.md)。技术栈保持现有 TypeScript / React / Vinext / Workers / D1。

当前状态：**阶段0、C1、C2-A、C2-B与C2-C本地已交付；Codex全权负责前后端，不调用其他模型或子代理。** 已接收并保留Gemini交接v3。C2-C补齐纠正/CAS、原回执重放和受保护分页历史；全套101/101项测试、非增量类型检查及内存D1绑定验证通过。删除仅准备文档，物理删除/防复活/过滤恢复未实现，真实私人导入仍禁止。未部署、未挂载Studio、未验真实账号/手机。生产/依赖/提交授权边界不变。

最新授权覆盖第5节历史分工和各历史批次的停止点：用户要求Codex接续开发并加快进度，Gemini暂停至另行通知。保留后文历史任务说明作追溯，不再视作当前前端禁改规则。G3确有Chrome渲染/状态测试，但完整回执、真实键盘焦点、减少动画及逐视口断言仍有证据缺口，不能记为真实手机或私人HTTP集成通过。

G3接收状态：最新Gemini交接为v3，Chrome合成状态测试与320/390/1280截图确实存在；报告称12项，summary实际13项。不能据其部分回执夹具、按钮高度或默认747px布局测量认定完整协议、键盘/减少动画/逐视口均验收。原始产物保留；下一前端批次由Codex补齐。实际证据见[Codex交接版本5](handoffs/codex.md)和[Gemini交接](handoffs/gemini.md)。

## 1. 授权和长期约束

- C2-C本地纠正/CAS/历史与删除准备已完成；后续按第4节落实删除安全，再补Studio闭环。Codex独立实施和审查。禁止依赖/生产配置改动、线上写入/资源创建、定时任务调整、Git提交/推送。C2-B、C2-A、C1和阶段0的范围/停止点仅为各自历史批次记录。
- 后续用户说“继续”，先读取当前约定、文档、Git 状态与其他工具改动，选择 1—3 个相关小任务。不能自动推进所有阶段。
- 本地代码开发、合成数据测试与文档更新按当轮授权实施。线上迁移、部署/推送、资源/费用/权限变更、生产调度和公开范围需要明确授权；“继续”不能覆盖这些单独门槛。
- 保留首页、全小写字标、字体、摄影、交互和 `--editorial-*` 变量，不换框架或重设计。空数据不伪造成果，未知不初始化为已掌握。
- 私人配置不进公开文档/测试数据/构建产物；新事实默认 private。旧日摘要和旧 practice 不补造原始证据。
- 同类正式数据只有一个写入主库；不靠每日维护中间文件、Codex 推送内容文件或私人页面抓取做正式同步。
- CCG Task 记录阶段与归档；本轮禁提交优先于归档提交惯例，任务只做本地归档。不要为节省额度省略鉴权、事务和必要测试。

## 2. 阶段 0 已执行检查

| 检查 | 本轮结果 | 实际边界 |
| --- | --- | --- |
| 项目指令/规范/代码/旧文档 | 已读核心前端、lib、全部 API、worker、SQL、脚本、测试、部署工作流与现有规范 | 旧设计/迁移文档为历史依据，不作最新授权。未修改全局配置。 |
| Git 状态/分支/远程 | 初始 tracked 干净；保留 24 张未跟踪截图；main=a855183，GitHub 当前 main 同 SHA | 未 fetch、切分支、合并、暂存、提交或推送；另一设计分支保留。 |
| 现有测试 | `C:/Program Files/nodejs/node.exe --experimental-strip-types --test tests/*.test.mjs`：17/17，通过 | 执行与 package.json test 相同的测试入口；内存 SQLite、合成签名身份/mock，不写线上数据。 |
| 类型检查 | `C:/Program Files/nodejs/node.exe node_modules/typescript/bin/tsc --noEmit --incremental false`：exit 0 | 使用现有依赖，关闭增量写盘，不重装、不更新锁文件。 |
| 本地生产构建 | **本轮未运行** | 默认 build 会清理共享 dist，旧文档记录运行中目录锁；纯文档审计不覆盖其他工具的构建/本地状态。不能写为本轮构建通过。 |
| GitHub CI/部署 | 最新 Check 38390181588、Deploy 38390181618 成功；部署 job 的 test/typecheck 与 build/migrate/deploy 步骤成功 | 这是远程既有运行结果，非本轮触发；不等于手机端/真实写入通过。 |
| Cloudflare 配置只读 | Worker/D1/Access、同生产 Worker 的两个域名、两条 Cron、Builds main 自动触发均核验 | 未读 Secret 值、未修改设置；Builds 列表为空，不判定其真实发布路径已跑通。 |
| 线上匿名 GET | 首页、learning、projects、records、snapshots 为 200；公开记录/快照各 4；admin/API admin 为 302 到 Access；sync GET 为 401 | 没有凭证写入、撤销或浏览器端到端测试。API no-store 已读取；边缘自定义规则未核验。 |
| 官方接入资料 | MCP/OAuth、手机插件、Actions、定时任务和 D1 原子 batch 已核对 | 平台能力不等于当前用户账号或 Wayneo 集成成功。 |
| 本机同步配置 | wayneo-dev 为 ACTIVE，每日 06:00，引用旧复盘来源 | 仅读配置，未触发/改动任务；不恢复旧教学计划、日报/周复盘。 |

初次 .NET HTTP 请求因本机 TLS 连接失败未取得结果，后来 Node 原生 fetch 的只读请求成功。这个工具差异不作线上站点故障证据。Git status 出现全局 ignore 文件读取权限警告，仍读到仓库状态；未更改全局 Git 设置。

未核验项：Google OIDC、稳定身份映射、当前本人登录/编辑、ChatGPT 网页及常用手机实际授权/确认、平台定时接入、后台限流/缓存、Environment 审批/Secret范围、分支保护详情、完整恢复、线上数据库逐表结构、成本上限。阶段 0 无需用户为这些事项先开通新资源。

## 3. 分阶段任务与依赖

| 阶段/小批次 | 依赖与范围 | 验收/交付 |
| --- | --- | --- |
| **0：审计与收敛** | 当前代码、只读后台与官方文档 | 本文 + architecture + 项目约定；记录真实能力、边界与下一批。完成后停。 |
| **1A：隔离与权限基础** | 阶段 0；只用本地/合成数据 | 固定身份/grant/scopes 契约；完善服务端拒绝默认行为与本地迁移入口。任何新私人接口先鉴权。明确生产/本地目标，测试域名不得用于写入。 |
| **1B：一个事件可靠保存** | 1A | 新事件/修订/回执/任务/数据版本；同键同载荷重放、同键不同载荷冲突、同日两次练习保留、时间未知与延迟归属、事务失败不留孤立行。只本地执行迁移。 |
| **1C：最小读取/修正/上下文** | 1B | 按 owner 读取事件、expected_revision 修正、历史修订可追溯、版本与覆盖范围上下文；保存回执再次读取核对。持久任务可显式重放，不要求重述历史。 |
| **1D：迁移和展示边界** | 1C + 公开范围确认后才发布 | 合成旧数据导入/重复导入/数量与内容核对/恢复；新私人数据不走旧公开 API；新读取开关只在本地/隔离环境验证，保留原视觉与旧内容回退。 |
| **2A：最小 Studio/Google** | 私人事件闭环；远程测试另需授权隔离资源 | 复用成熟 OIDC/Access；稳定用户 ID、服务端 owner 白名单、普通登录无管理员权。Studio 一个补充入口，展示当前已知内容和必要提醒，不展示复杂日志。 |
| **2B：真实 ChatGPT 接入** | 1C + 可用独立预览 + 用户账号授权 | 优先 MCP/OAuth；网页/常用手机做读→提交合成事件→回执→回读→重试→撤销。记录每次确认/点击与覆盖来源。不可用项明确标记，数据/界面可继续。 |
| **3A：档案/大纲/现实安排** | 事件来源与权限稳定 | 稳定知识 ID、别名、必要前置循环检查、推荐关系、大纲版本；事件与成果/目标多对多；学校提交/验收与能力证据分离。路线变化不丢成果。 |
| **3B：评估/当前计划** | 3A + 有可检查证据 | 分维度评估、支持/反证/提示与运行条件、题目和答案版本；旧数据版本结果不能覆盖新修正。按现实期限/预算出解释清楚的建议，只有一个当前计划。 |
| **3C：局部调整与上下文** | 3B 建议核对达标 | 按用途裁剪上下文；临时兴趣不推翻主线；明确决定执行，模型主动大方向请求确认；局部重排受预算/已开始任务约束，无反馈不猜原因。 |
| **4：公开内容逐步丰富** | 有真实内容 + 已授权白名单 | 优先现有 Journal、Now/Projects；有素材才扩展 Notes/Roadmap/搜索。技术核验、贡献来源、撤回缓存/索引、移动回归；无数据隐藏空模块。 |
| **5A：可靠自动运行** | 真实集成可用 + 明确生产调度授权 | 事件触发为主，有限重试/租约/补偿/备份恢复；处理状态可查、通知合并，模型故障保留事实和旧计划；核对 UTC Cron 与学习日。 |
| **5B：学习效果与成本** | 证据质量/使用量足够支持比较 | 主动提取、可配置复习/延迟验证/混合练习；有反馈再调整，与简单规则比较。FSRS 可替换且仅用于合适回忆项；观察负担、正确性、独立表现与适配，不只完成率。 |

边界说明：现有数据库与 API 不用从零创建；1A 是补齐隔离/私人授权。Google 配置可与 Studio 合并到 2A，独立预览的准备可提到 2B 前；不能绕过私人鉴权、可靠保存或真实接入验收。初期不运行模型分析，仅把待处理事实可靠保留。

1D切换真实私人写入前还需完成用户删除与授权撤销：删除关联修订/任务/派生正文，恢复时应用删除状态，不让旧任务复活内容；确认备份保留策略。自动公开和真实私人导入都不能以“接口测试已过”为由提前启用。

## 4. 接管后的下一步

按文件与验收边界连续推进，不等待Gemini：

1. **删除安全本地已完成。** C2-D实现物理删除、无正文重放拒绝、读取屏蔽与隔离恢复过滤。真实私人导入仍等待存活检查点/保留策略和完整恢复流程，不能仅凭本地接口测试开启。证据与限制见[删除与恢复](private-deletion.md)。
2. **Studio完整本地闭环已完成。** C2-E组件/HTTP闭环与C2-F完整构建、workerd实际Vinext路由及Chrome/内存D1验证通过；无需重做已通过的组件/框架检查。真实账号、独立远程接入与常用手机尚待下一门槛。
3. **真实接入另过授权门槛。** 获授权后准备独立远程Worker/DB与Access owner，再接MCP/OAuth并由实际网页/常用手机验读写/回执/重试/撤销；不把study-test生产别名当预览。

距离口径：可靠私人数据底座已具备，最小私人可用闭环正在接近，但尚有上述本地补齐和真实授权验收。完整目标的档案/知识大纲、证据评估、唯一当前计划、公开白名单/撤回、可靠任务执行/备份恢复与成本管理大多仍未实现。阶段大小不同，不能将已完成小批次数量折算为准确百分比或交付日期。

### 以下为C2-A时的历史任务说明

1. **Codex C1：已完成本地基础。** 新增`lib/learning/auth.ts`、`lib/learning/contracts.ts`、`migrations/0002_learning_events.sql`和两份learning-*测试。仅五张空表与独立认证模块；真实Access身份绑定/Google/私人HTTP接口尚未实施。29项全套测试、类型检查、隔离Miniflare/workerd D1迁移检查通过；未迁移共享本地库或生产库，未运行应用构建。
2. **Codex C2-A：已完成本地原子保存与回执。** 新增输入校验、saveLearningEvent服务、两张回执/outbox空表迁移和22项核心测试；幂等重放/冲突、权限新鲜度、并发、必要写入零行/异常回滚与错误脱敏均有本地证据。后续C2小批次再按owner提供私人读取/小上下文与受保护HTTP入口；修正单独验收，不一次承诺整个1C。后续归属仍为`lib/learning/`、`app/api/studio/**`和核心learning-*测试。
3. **Gemini G1：已验收。** 用户交接报告称17项测试与typecheck通过；Codex逐字核对HEAD与当前journal，只含“快照保存于…”和“练习与补充”替换，无额外代码变化。Codex本轮全套29项测试和typecheck再次通过。未构建/浏览器验收，不宣称视觉回归已测。下一单升级为下面的完整前端任务包。

本批到C2-A停止。下次“继续”先接收双方最新交接，再只选私人读取/上下文/受保护入口中可共同验收的一小段；不一次完成所有接口/Studio。Gemini的G3组件交付已收到，浏览器实测仍由Gemini负责。Codex不抢做视图，不重复Gemini测试开发。

## 5. 历史并行规则（当前已暂停）

本节保留旧分工作追溯，不再约束Codex前端接管，也不授权调用Gemini/其他模型；以开头最新用户授权为准。

### 文件归属

| 负责人 | 第一批/后续范围 | 对方禁改 |
| --- | --- | --- |
| Codex | `lib/learning/**`（含共享contracts）、`app/api/studio/**`、新增migrations、核心learning-*测试；服务端身份/路由保护服务 | Gemini不改鉴权、SQL、API handler、核心业务规则、共享协议、部署工作流、Wrangler、package/锁文件。 |
| Gemini：全部视图层 | `app/studio/**`客户端视图、`lib/ui/**`、`tests/studio-*.test.mjs`；后续阶段4选定的公开模块组件、前端交互与组件测试 | Codex不改这些视图/请求封装/组件测试。公开现有页面修改按下一批具体文件名单分配，不提前大改首页。 |
| Gemini G1（已完成） | `app/journal.tsx`文案，后续日志展示仍归Gemini | Codex只提供公开DTO/API；不直接调整日志组件。 |
| Codex 集成 | architecture/plan/Task状态、统一构建、最终测试、权限与发布审查 | Gemini给出交接说明，由Codex更新当前计划；不让两边同时写计划。 |

两边开始前运行 `git status --short`，记录看到的既有修改与自己范围。共享目录中无 tracked 修改也不代表另一个工具没有正在编辑的内存缓冲；按明确文件归属工作，不 reset、checkout --、clean 或恢复对方内容。不要切分支、stash、合并、提交/推送，除非另行指定集成负责人和授权。

开发可以并行，**最终构建与验收顺序执行**：G1/G2交付 → Codex读取实际diff → 自己任务完成 → 一次 test/typecheck/build → 交互/权限验收。两边不同时跑 build/dev，不清理 dist/.wrangler，不对共享本地库执行迁移，不运行 db:remote/deploy/import/同步上传。Codex 使用隔离的临时/内存测试库，最后统一处理本地运行服务；Gemini默认只做无输出的类型检查，不跑数据库脚本。

### 可直接交给 Gemini：G1

```text
在 D:\codex_dev\web\wayne-site-migration\wayne-site 开发 Wayneo G1。
先读 AGENTS.md、.ccg/spec/frontend/index.md，以及 docs/architecture.md 的现状/时间问题。
你与 Codex 共用目录，Codex 正在做 lib/learning、新接口和测试。只能修改 app/journal.tsx；不要恢复或覆盖任何其他人的修改。先检查 Git 状态并读完整 journal 文件。

任务只有两个文案调整：
1. 非历史快照模式中，lastSync 的“更新于 …”改为“快照保存于 …”。API 里的 lastSync 是快照时间，不能表示新学习或内容同步。lastSync为空时维持现有“学习手记”，不要生成当前时间。
2. practice 展示标题和编辑表单标签中的“后续练习”改为中性的“练习与补充”，避免把历史补充或计划当已完成实践。保留现有字段、内容和空值行为。

不改 API 请求、数据类型、输入格式、样式、首页、Logo、主题、日期规则或其他行为。不批量整理历史正文，不做自动同步/模型调用。
检查差异是否只含这两类文案，并做现有依赖的 TypeScript noEmit 检查；不要升级依赖、运行 build/dev、迁移、部署、Git提交/推送。若文件已被其他工具修改，保留并只补自己的文案，无法分辨时先交接，不重写文件。
交付：修改文件、实际检查结果、尚未验证事项。由 Codex 统一做最终构建和页面验收。
```

验收：最新内容旁明确为快照时间；practice标题与编辑标签一致且中性；正文/空状态/历史浏览/保存请求不变。该小改动不新增镜像实现的测试；统一集成时复用现有测试并检查页面。

### G2：完整Studio前端任务包（替代原先只有概览组件的第二单）

G1已交接，用户明确提高Gemini工作量并将全部前端交给他。本任务包可现在分配，与Codex后续C2并行；无真实私人API前，只在合成组件检查中运行，不新增可匿名访问的Studio路由。只有后端鉴权、真实数据和端到端验收通过后才记为Studio功能。

Codex已交付`lib/learning/contracts.ts`中的LearningEventInput、LearningEventDTO、SaveReceiptDTO、LearningContextDTO、LearningAPIErrorDTO。Gemini必须`import type`复用，不复制/修改协议，不从`auth.ts`导入运行时代码。API尚未实现，预定端点在架构第6节；补充表单当前用回调，不伪造API成功。后端协议调整先记录受影响组件，再由Gemini一次适配。

Gemini按下面三批连续完成，后批依赖前批类型/组件，Codex只做契约和边界审查，不逐文件重复实现：

| 批次 | 允许创建/修改 | 任务和验收 |
| --- | --- | --- |
| G2-A 概览与阅读 | `app/studio/studio-overview.tsx`、`studio-overview.css`、`studio-event-list.tsx`、`studio-event-detail.tsx`、`studio-events.css` | 保留下面概览props；事件列表接收readonly LearningEventDTO[]，详情接收LearningEventDTO或null。支持加载/空/错误/重试、选择事件、未知日期；相同日两次事件不合并删除。全部文本转义，无分数/假计划。 |
| G2-B 补充与交互 | `app/studio/studio-supplement-form.tsx`、`studio-supplement-form.css`、`studio-client.tsx`、`studio-client.css` | 一个自然语言补充表单，受控text/state与onSubmit/onChange回调；保存中防重复点击，失败保留文本，只有父组件收到真实回执才显示已保存。客户端组合概览、列表、详情和表单，通过可注入数据适配器工作；组件内不硬编码生产地址或权限，不自动执行目标变更/删除/公开。无生产路由、无后台模型/定时任务。 |
| G2-C 请求适配与检查 | `lib/ui/studio-client.ts`、`lib/ui/studio-view-model.ts`、`tests/studio-client.test.mjs`、`tests/studio-view-model.test.mjs`；必要时`tests/studio-components.test.mjs` | 请求封装用相对URL+注入fetch，默认同源凭证，支持超时/abort与非JSON响应；401/403不假装空档案，409保留草稿并说明冲突，5xx/断网可重试。一次操作的幂等键在重试中保持不变；不自动改载荷后沿用旧键。合成测试检查请求、错误、过滤与表单状态；不新增依赖/碰共享构建输出。 |

接口约束：列表props为`{events: readonly LearningEventDTO[]; selectedEventId: string|null; loading: boolean; errorMessage: string|null; onSelect: (eventId:string)=>void; onRetry: ()=>void}`；详情为`{event: LearningEventDTO|null; onClose: ()=>void}`；表单为`{text:string; state:'idle'|'saving'|'saved'|'error'; errorMessage:string|null; onChange:(text:string)=>void; onSubmit:(text:string)=>void}`。这些组件不自行fetch；适配器单独负责IO，客户端容器控制状态。第一版只做新增补充；发生时间未知不填当前时间、未知证据不升级能力。自然语言转正式事件的业务解析仍由Codex后端负责，表单与回调先可独立检查。

G2-C的fetch适配按共享类型包装`POST /api/studio/events`、`GET /api/studio/events/{event_id}`、`GET /api/studio/context?purpose=teaching`；响应为直接DTO，错误为`{error:{code,message}}`。测试明确标记synthetic并注入fetch；没有实现的端点不得实际调用或宣称可用。若需要额外事件列表接口，提交所需类型/查询需求给Codex，不自行改API或用旧公开records冒充私人数据。

固定展示接口（由 Gemini导出，同名属性不擅自变更）：

```typescript
export type StudioOverviewProps = {
  currentFocus: { title: string; detail: string } | null;
  notice: { kind: 'info' | 'action_required'; text: string } | null;
  connectionState: 'not_connected' | 'available' | 'temporarily_unavailable';
  lastContentUpdatedAt: string | null;
  supplementHref: string | null;
  loading: boolean;
};
```

```text
开发Wayneo G2-A/B/C，按本节三批文件归属逐批完成。全部前端视图、交互、请求封装和组件测试由你负责，Codex负责核心后端和共享契约。先读AGENTS、前端spec、本节完整要求和lib/learning/contracts.ts；与Codex共用目录，不覆盖他人改动。
先完成概览、事件列表/详情，再补充表单/客户端组合，最后请求封装与合成检查。复用下方StudioOverviewProps及上方列表/详情/表单接口。不要修改shared contracts、auth、SQL或API handler，不创建page.tsx/公开Studio路由、导航或生产调用。只在你拥有的组件/测试中验证。
currentFocus=null时明确“当前暂无已确认安排”，不虚构计划或能力；loading=true显示读取状态，不展示假日期。connectionState准确区分未接入、可用、暂时不可用；lastContentUpdatedAt=null不标为刚更新，只用传入内容更新时间。无notice不占提醒区；supplementHref=null不显示可用的补充按钮。链接目标由Codex可信容器提供。
复用--editorial-*、现有字体/颜色，样式只作用于.studio-overview后代，禁止全局body/html/:root规则。320/390px长中文与代码引用不撑破页面；按钮/链接有键盘焦点、语义标签和足够触控区域，减少动画偏好可用。默认渲染转义文本，不用dangerouslySetInnerHTML。
合成示例只能用于明确测试，不混入真实数据；不读写私人localStorage/凭证，不把合成事件提交到站点。使用已有Node/React/TypeScript和测试入口，不加依赖，不启动共享build/dev，不迁移/部署/提交。每批报告文件、接口、实际检查与剩余阻塞，最后一次交付完整前端。
遇到协议缺口，给Codex最小复现、报错、相关文件和所需输入/输出，不重新设计后端或猜权限。接口未实现时继续独立组件与合成fetch测试，不把不确定日期、来源或计划编造完整。
```

验收：视图无外部IO，适配器可注入/隔离检查；空/加载/断连/长文本/权限/冲突均诚实显示，失败不丢草稿。Gemini负责前端后续浏览器/触控/组件检查；Codex提供服务端保护函数与API后，再协作挂载路由和做真实闭环。纯组件或合成fetch通过不叫“私人空间已上线”。不调用双模型或由Codex派代理重复开发。

后续阶段4的Now/Projects/Journal及按需Roadmap/Notes/搜索组件、阅读体验、主题与可访问性交互均归Gemini；Codex提供公开白名单DTO、发布/撤回与查询服务。范围仍按真实内容和逐批验收推进，不提前制造空模块。普通前端类型映射、状态处理和测试夹具也由Gemini完成，尽量使用其额度。

## 6. 最小闭环验证清单

所有首次接口/迁移测试用合成数据；本地通过后才申请独立远程预览。测试需要证明结果与失败恢复，不能仅检查函数存在。

- [x] 1A本地：匿名、伪造/过期令牌、错误受众、普通登录、错误owner、缺scope与已撤销grant不能私人读取/写入；真实账号/边缘保护尚待验收。
- [x] 1B本地：重复同键同内容只有一个事件/版本/任务；同键不同内容报IDEMPOTENCY_CONFLICT，C2-B HTTP映射409。同日两个不同事件完整保留。
- [x] 1B本地服务：05:59:59/06:00边界、跨年、延迟接收、明确日期覆盖、仅知日期/未知发生时间正确；接收时间不冒充学习时间。
- [x] 1B本地服务：全部五个必要INSERT及既有版本UPDATE的异常/零行整体回滚；并发同键重放/冲突、权限变化和提交响应丢失恢复已测。仅内存SQLite与D1，不代表线上验证。
- [x] 1C本地：纠正可追溯、旧expected_revision拒绝；原回执重放与当前读取版本清楚区分，受保护历史分页已验。仅合成SQLite/D1，未部署。
- [ ] 3B/5：旧评估/计划不能覆盖新证据；当前无评估/计划执行器，不能据纠正测试认定已验收。
- [x] 1C本地：context带同快照版本、来源覆盖与未知范围；不以生成/接收时间冒充学习、不声称全聊天已覆盖，最多64KiB。
- [ ] 1D：合成旧摘要/旧practice导入不产生独立练习；重复导入可检查；导出→隔离恢复→内容/数量/关联/版本与处理状态核对。
- [ ] 1D：私人删除同时清理修订、任务/派生正文与相关附件；旧任务重放/备份恢复不复活内容，授权撤销后读写明确失败。
- [ ] 1D/4：公开API、旧快照、缓存、搜索、构建资源均无私人字段；撤回覆盖历史公开副本；新内容无需代码部署并实测刷新延迟。
- [ ] 2：真实教学入口和常用手机读写/回执/重试/撤销均测，记录确认次数与故障反馈；模拟测试单独标记。
- [ ] 3：概念答对不升级独立编写；AI代码测试通过不当个人独立成果；学校成果与复盘不重复计证据。
- [ ] 3：临时兴趣不推翻路线、明确决定生效、紧急学校事项可重排、已开始任务稳定、无反馈不猜原因、不形成无限补课。
- [ ] 4：现有首页/Logo/字体、learning/projects、主题、移动/长中文/代码/键盘/减少动画无非预期回归。
- [ ] 5：接入/模型故障事实不丢、结果可复用、租约和退避有限；成本限额与备份恢复可观察，通知只针对有意义故障/变化。

## 7. 用户以后需要完成的最少事项

本轮无需配置。独立任务受阻时只停对应部分，不反复要求提供代码中已有答案。

| 何时 | 最少决定/配置 | 此前可继续 |
| --- | --- | --- |
| 远程集成测试前 | 授权创建隔离预览 Worker/DB，并确认使用现有账号的成本范围；不改变正式DNS/资源 | Codex继续本地事件/鉴权/恢复与Studio开发。 |
| Google/真实接入时 | 在官方流程授权Google/OIDC与选定MCP插件；用实际常用手机完成一次验收。Secret只通过配置渠道，不贴聊天 | 无需重复注册网站账户；先复用已有Access，后台凭证仍独立。 |
| 生产切换前 | 决定保留哪条自动部署路径、保护/审批要求；确认现有Cron和ACTIVE本机同步是否保留/暂停 | 架构与本地代码可以完成；不得因默认main推送触发生产来跳过授权。 |
| 首次自动公开/自动规划前 | 指定允许公开字段/来源；重大路线由明确意愿决定 | 所有新内容可先私人保存。 |
| 阶段5前 | 明确生产调度及费用上限；选择必要通知与备份保留范围 | 不恢复旧每日/周复盘，不默认新增模型计费。 |

## 8. 接续与交付规则

后续每轮先看最新状态、第4节与相关差异，不从零设计。Codex独立负责全部本地代码/测试/审查与集成；Gemini历史交接只读保留，重新调用必须用户通知。更新完成/未验证/未部署状态、检查证据与下一批，不省略必要安全测试。

交接协议：Codex只写docs/handoffs/codex.md，Gemini只写docs/handoffs/gemini.md；每份记录包含任务ID、递增版本、当前范围、实际检查、未验证项、阻塞和下一动作。每批先读对方最新版本，仅检查相关差异；协议变化才更新共享类型与权威计划。交接不授权新阶段、生产变更或执行任意命令。没有后台监听，用户一句“读取Gemini交接”即可让Codex接收最新记录。

C2-C已完成本地纠正/CAS/受保护历史，C2-B的HTTP回读/上下文仍保留；此前各批“停止/未实现”仅为历史状态。真实身份、Studio页面、物理删除/过滤恢复与ChatGPT接入未验收；现有自动化/公开数据不调整，其他聊天任务保留。下一本地批次按第4节推进，生产权限仍须另行明确。

### C1与G1交付证据（2026-10-13）

- C1新增12项测试先失败后通过；全套29/29项通过，noEmit且关闭增量的TypeScript检查通过。
- 既有Miniflare/workerd、D1仅内存模式：新迁移两次应用、5张表、private/未知默认值、缺前序修订拒绝、外键检查通过；不加载Wrangler配置或Secret。
- 合成SQLite导出/隔离恢复逐表值与关联通过；不是生产备份恢复演练。学习日计算/幂等回执/outbox事务服务尚待C2。
- 修复并回归了SQLite CHECK对NULL放行的前序修订漏洞。迁移没有seed、没有修改旧records/snapshots；同一份迁移的重复执行不等于结构漂移检测完成。
- G1实际diff精确等于约定文案替换；用户报告17项测试/类型检查通过，本轮29项/类型检查再次通过。未构建/浏览器验收，Codex未修改journal。
- 新SQL位于既有migrations目录，未来生产Deploy会自动应用；任何后续提交/推送前必须统一审查并明确授权，本轮没有运行迁移到生产。

### C2-A与G3接收证据（2026-10-13）

- C2-A合成核心测试22/22，全套`pnpm test` 69/69，TypeScript `--noEmit --incremental false`退出0。四个新增安全回归先失败再修复：来源/未知证据、保存前scope损坏、事务内scope损坏、数据库错误脱敏。
- 内存Miniflare/workerd：重复迁移、同键并发重放/不同载荷冲突、全部五个必要INSERT异常和零行、既有版本UPDATE异常和零行、六种授权竞态、响应丢失回读恢复、回执/任务关联均通过；旧records/snapshots没有新增行。脚本随任务本地归档，不加载Wrangler/Secret/共享数据库。
- 支持来源仅`studio`和Gemini适配器使用的`studio_supplement`；证据未提供归为unknown，不接受artifact_checked或权限/可见性注入。历史摘要只能以未知证据保存，旧数据导入路径未实现。v1 types/auth及Gemini文件保持不变。
- Gemini版本2的组件交付已接收；实际全套测试含其6项组件检查。静态渲染/合成请求不等于交互状态机的浏览器端到端验证，320/390px触控/键盘/截图仍未实测。
- 按本轮额度与授权边界做单人审查并本地归档，无外部模型/子代理、构建/服务、提交/推送/部署、线上迁移或自动化改动。尚未实现HTTP接口、事件读取/修正/上下文、任务执行、公开投影和真实ChatGPT接入。

### C2-B与Gemini v3接收证据（2026-10-13）

- 新增16项读取/HTTP安全测试；全套`pnpm test`85/85、非增量noEmit类型检查退出0。首轮读取0/8与HTTP0/5因未实现失败后通过；超大流cancel异常503→413回归先失败再修复。另补同快照版本一致性与缺当前修订拒绝的行为测试。
- 已安装Miniflare/workerd内存D1绑定：签名owner HTTP保存/原回执重放/回读/context、六类grant竞态、owner禁用竞态、owner隔离与外键检查通过；旧records/snapshots为0。handler在Node调用D1绑定，不等于Worker框架路由派发。
- 自审确认无未解决的本批阻断项；保留Studio完整回执、并发/焦点等下一批缺口。共享contracts SHA与C2-A相同，auth/atomic save/迁移/public及Gemini历史产物本批未改。
- 没有应用构建、浏览器重跑/页面挂载、真实Access/OAuth/ChatGPT/手机验收；未加载生产配置/Secret、操作共享或线上库、安装依赖、提交推送/部署、调度或外部模型。任务仅本地归档。

### C2-C交付证据（2026-10-13）

- 13项纠正/历史核心测试与3项HTTP测试新增；初始核心0/9、HTTP6/9失败后实现通过。自审发现分页游标可绕过损坏当前正文，回归先12/13失败再13/13通过；全套101/101及非增量类型检查退出0。
- 内存Miniflare/workerd D1：签名owner保存/纠正/原回执重放/回读/历史，correction-only grant，同/异key并发、旧CAS、丢失响应，五个必要写入10种ABORT/IGNORE整体回滚，7种grant竞态/重放拒绝、owner禁用/隔离、历史分页与坏head拒绝均通过；旧records/snapshots为0，外键正常，0004重复应用通过。
- 自审报告、删除准备与验证脚本归档于`.ccg/tasks/archive/2026-10/wayneo-c2c-corrections/`。作者自审非独立审查，未调用其他模型/子代理；无提交推送/生产/配置依赖改动。
- 共享v1仅新增纠正/历史类型，现有UI与Gemini产物不改。物理删除/防复活/过滤恢复未实现；框架派发/构建、Studio挂载/浏览器与真实账号/手机/ChatGPT仍未验收。
