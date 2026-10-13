# Codex 接续记录

所有者：Codex。本文件只由Codex更新；Gemini历史交接保留不改。

## 当前交接：版本12，2026-10-14

- 用户“继续”后完成 C2-J 上线准备；仅本地代码、构建、测试和线上只读核查。Gemini v3 保留，无其他模型或子代理。
- 生产 Access 只保护旧 admin 路径；同应用/同 owner 策略拟新增两个域名的 studio 与 api/studio 四个 destination。配置/旧路径/audience/idP/会话/Secret/Cron/DB 保持，未执行更新。
- 新签名 verifiedOwnerIdentity 与 GET registration 只读生成 disabled 登记提案，不自动注册、启用、提升 member 或透露 JWT/学习内容。真实 subject 须来自实际登录后的签名身份，不能猜测。
- release-preflight 生成精选文件 hash、生产配置匹配、旧版本回退和 Access 变更清单。现场快照和 manifest 在忽略的 data/studio-release-preparation-2026-10-14；发布前须刷新现场、远端 HEAD 与清单。
- 136/136、非增量 noEmit、隔离五阶段完整构建成功；实际 Worker 内存 D1 的 26 个请求通过，包括新入口 users 零新增与未登记 context 403。
- 下一步申请提交推送 main、生产 Worker 发布和既有 Access 四路径扩展的明确授权；真实 owner 登记/启用、私人导入、备份配置、费用/调度不包含。当前回退 Worker 版本见 docs/studio-release-readiness.md。
- 总体粗估 50%–55%，本批 +2 个百分点，非上线比例。

## 历史交接：版本11
## 当前交接：版本11，2026-10-14

- 用户在明确wayne-learning上0002–0005四迁移/9空表范围后回复“确认”。本轮C2-I实际执行该生产DDL及ledger；不把这次确认扩展为Worker部署、提交推送、账号权限、私人数据或调度授权。
- 执行前重新核对现场schema/ledger/Worker DB绑定、四文件hash与认证账号成员关系；刷新旧公开数据备份并内存恢复逐值核对。CLI未认证，复用已有Cloudflare连接，不要求新登录/凭证。
- 逐文件query API提交获确认SQL+ledger插入，附迁移前缀守卫；四项各HTTP200/全语句success。生产ledger时间北京时间01:54:00–01:54:31。
- 直接生产核验：9私人表全0行，ledger0001–0005且无待迁移，schema指纹与演练一致，FK空；旧4日志/5快照迁移前后导出全字段逐值相同；首页/learning/projects/records/snapshots均HTTP200。
- 复合UNION计数请求失败于线上SQL限制，没有改写/重放迁移；标量计数复验通过。一次连接传输失败及CLI未登录已用可用连接路径解决。
- 证据在忽略的data/pre-migration-confirmed-2026-10-14和post-migration-confirmed-2026-10-14，详细摘要docs/database-migration-result.md。无应用源码变更，不重复此前130/130；本轮是直接生产验证。
- 下一步可准备Studio新Worker部署/真实owner登记和独立远程接入的具体方案，取得对应明确授权后执行。私人导入仍待备份策略与真实账号验收。没有新部署/资源创建/Secret/费用/权限/Cron、其他模型或子代理。

## 历史交接：版本10

## 当前交接：版本10，2026-10-14

- 用户询问数据库后“好的，继续推进”。执行C2-H只读现场核查与迁移准备，不推定此句已明确授权生产迁移。
- Cloudflare API：生产DB名称/UUID/Worker绑定一致；sqlite_master旧业务records/snapshots与ledger0001，无私人表；4日志/5快照，SQL元数据无改写。没有读取正文/Secret。
- 另用既有公开导出工具GET导出应用旧内容到忽略的data/pre-migration-2026-10-14，内存恢复和新迁移后内容/版本/快照/时间逐值一致。不是D1完整备份或私人数据备份。
- 新migration-preflight只读本地元数据，拒绝ledger/结构漂移，四文件hash/最终schema指纹计划已生成。新增4项测试；130/130与非增量noEmit通过。内存D1验证4/5合成旧值保留、0003错误DDL/ledger回滚、接续后9私人空表/FK正常。
- 线上仅拟申请wayne-learning上0002–0005四迁移及ledger。准备完成后向用户请求这个具体范围；不包含部署、提交推送、用户/grant、私人导入、权限/费用/DNS/Cron或资源创建。还未执行线上DDL。
- 下一步若用户明确批准此范围，先刷新schema/ledger/hash和备份验证，然后单独迁移，结果核对；不能用pnpm deploy打包未授权部署。未批准时仍停在线上写入之前。
- 本批无其他模型/子代理、依赖/生产配置改动或共享数据库写入。详见[数据库上线准备](../database-migration-readiness.md)。

## 历史交接：版本9

## 当前交接：版本9，2026-10-14

- 用户“继续推进”且要求每批报告总体/本次进度。完成C2-G本地加密备份与完整空目标隔离恢复，选择备份缺口作为可自主推进的小批次；未用“继续”推定远程资源/权限/生产授权。
- 新增private-backup.ts：同快照active-owner导出、结构/关系/修订校验、AES-256-GCM独立备份/检查点；显式owner/检查点高水位/隔离声明、空目标守卫、一次D1 batch导入过滤推进版本并停用owner/撤销grant，旧任务不恢复。
- 复用restore-deletions的deletionRestoreStatements事务构建器；旧filter服务行为保留。没有新迁移、HTTP/UI/存储提供方/密钥配置，不触发生产资源或调度。
- 新增9项测试，全套126/126、非增量noEmit通过；SQLite18种失败注入、密文篡改/错key/错用途/旧检查点、历史窄grant、空owner/鉴权竞态/坏历史与响应丢失关闭状态通过。内存D122种ABORT/IGNORE、grant关联、旧备份+新删除检查点、版本5/保留1事件、owner/grant拒绝/FK通过。
- 本批仅服务+内存测试，没有写明文/密文备份文件或日志。未重跑UI/完整构建，因无页面/框架变化；此前C2-F证据继续保留。
- 下一步：可准备备份操作入口/密钥与存储方案及独立远程接入；最终存储/保留/费用/调度、真实Access/ChatGPT/手机、远程Worker/DB和部署仍需明确授权，真实私人导入仍禁止。
- 无提交推送/线上迁移写入删除、依赖/生产配置、其他模型或子代理。详见[私人备份](../private-backup.md)。

## 历史交接：版本8

## 当前交接：版本8，2026-10-14

- 用户“继续推进”下完成C2-F完整Worker验证。新独立完整构建脚本、内存D1/合成Access环境、实际路由运行脚本；浏览器脚本支持--worker完整SSR/资源/客户端链路。只修复Studio退出链接触控与焦点，生产配置/依赖保持。
- 隔离Vite5阶段完整构建通过；worker-runtime实际23请求通过：匿名401/页面拒绝，owner SSR/private-cache，保存/重放/回读/纠正/历史/context/删除，删除404/防复活409、跨源403/过大413/旧CAS409、member/disabled403。旧公开接口不含私人数据，公开表0行/FK通过。
- Chrome→实际Vinext Worker→内存D1：初始一次context、4 POST/2事件/3 context，连续提交锁/503原键/部分回执已持久化后的原键重放通过。三个视口无溢出、所有控件>=44px、减少动画none、Tab solid焦点/详情Escape返回通过。
- 全套117/117、非增量noEmit、完整重建均成功。测试ASSETS早期worker-first导致404，已改为原配置默认静态资源优先并重验。所有缓存/日志/构建/数据库位于独立目录或内存，不触碰共享dist和旧产物。
- 未测试真实Access/Google/OIDC/MCP/OAuth/ChatGPT/常用手机，没有部署或开启真实私人导入。下一步为独立远程资源/真实接入授权；备份检查点与保留策略仍需补齐。
- 无其他模型/子代理、生产/权限/费用/Cron变更、提交推送/线上迁移写入删除。详见[完整Worker验证](../studio-worker-verification.md)。

## 历史交接：版本7

## 当前交接：版本7，2026-10-14

- 用户“继续推进”授权下完成C2-E。`/studio`服务端先验证签名预登记owner；客户端稳定同源适配器、单次context、完整协议校验、同步锁、旧响应拒绝、留稿/原键重试已实现。默认浏览器fetch绑定globalThis修复已由Chrome验证。
- 复用既有样式与组件；未增加公开导航。覆盖范围/学习时间文案诚实，未知时间不生成日期，未接入评估/规划不宣称已有建议。
- 全套117/117、非增量noEmit通过。独立Chrome→本机实际HTTP handlers→内存SQLite→UI检查通过：4 POST/2事件/3 context，503及部分回执原键恢复；320/390/1280无溢出、44px控件、减少动画none、实际Tab solid焦点、详情打开与Escape/关闭焦点返回。
- 浏览器脚本与新增安全测试见tests/studio-browser.mjs、studio-safety.test.mjs。产物在忽略的tests/.generated；组件编译不再更新Gemini历史compiled。管理沙箱CDP超时后，同一隔离测试经自动审批在沙箱外通过。
- 仅客户端构建与Node handler浏览器链路；未完成全应用构建、Vinext Worker派发、真实Access/MCP/OAuth/手机，未部署。私人导入仍需完整备份检查点/保留策略与真实授权。
- 下一批先隔离完整框架构建、页面保护/路由验证，再按授权准备独立远程资源和真实接入。不重做已通过的组件测试或覆盖历史交接。
- 无依赖/生产/调度改动，无提交推送/线上迁移写入/部署、其他模型或子代理。详细依据：[Studio本地验证](../studio-local-verification.md)。

## 历史交接：版本6

## 当前交接：版本6，2026-10-14

- 本轮用户授权“继续推进”；完成C2-D本地删除安全及隔离恢复过滤，单人实施与审查。
- 新增0005迁移、deletions/deletion-support/restore-deletions服务、DELETE薄路由及协议；create/correct恢复路径拒绝旧键/来源/事件，读取/历史/context屏蔽删除标记下的正文。
- 删除仅签名预登记owner可执行，integration grant无删除权。CAS、owner状态与全部必要写入/整组删除守卫在同一事务；原删除回执无正文重放。既有公开表/UI/生产配置不改。
- 全套112/112测试、TypeScript非增量noEmit通过；内存Miniflare D1重复迁移、多修订删除、14种删除回滚注入、并发重放、防复活、旧备份过滤/版本高水位/FK通过。SQLite还验证恢复14种失败注入、旧正文读取屏蔽和同来源不同ID清理。
- 恢复是可信离线过滤服务，调用者必须确保隔离与完整存活检查点。未配置检查点独立存储/保留策略，完整私人备份/导入/授权恢复尚未实现；真实私人导入仍禁止。
- 未构建/挂载Studio、运行框架派发或浏览器、真实账号/ChatGPT/手机测试；未操作共享/生产库、Secret、依赖、定时任务、提交推送/部署。版本5及Gemini v3原交接保留作历史。
- 下一批：补前端完整回执校验、提交锁与单次context映射，再挂载受保护Studio并做隔离本地闭环；真实接入需另行授权。
- 详细协议/测试/剩余边界：[private-deletion.md](../private-deletion.md)。

## 历史交接：版本5

- 任务：`wayneo-c2c-corrections`，本地事件纠正/CAS、受保护修订历史与删除准备。
- 交接版本：5
- 日期：2026-10-13，Asia/Shanghai
- 已读取的Gemini交接版本：3；同时核对浏览器runner、suite、summary与报告。
- 最新授权：Codex全权负责前后端、测试与集成，暂停Gemini/其他模型/子代理，直到用户另行通知。旧前端分工与批次停止点不是当前禁改要求。
- 实际检查：文档更新后重跑`pnpm test`101/101，`tsc --noEmit --incremental false`退出0；已安装Miniflare/workerd内存D1绑定重跑退出0，`git diff --check`退出0；显式包含未跟踪文件的29份文本检查无空白/冲突标记问题。归档结果见任务progress.md；现有Git全局ignore权限/换行提示不通过改全局配置处理。
- 共享契约：v1仅新增纠正/历史类型，SHA-256 `2DF34C06E1C69577BE4D6427517640FC8871EAB24D2EF9E22E1ED0DA10C5C20E`。已有保存/读取/context/UI类型不变。
- 没有应用构建、浏览器重跑、Studio页面挂载、真实Access登记/保护配置、ChatGPT/OAuth/手机验收、部署/线上迁移、依赖改动、提交推送、自动化或外部模型调用。

## C2-C交付

- `corrections.ts`与共享`write-support.ts`：严格纠正信封、完整替换、非空原因与expected_revision；保留event_id/source/kind/原received_at/private，不把历史摘要变成独立练习。events:correct与write/read独立。
- owner/event/revision/source/kind条件CAS、data_version、新修订、原回执与pending任务同一D1 batch提交；五个必要写入均有事务内守卫。hash包含目标/CAS/原因/规范化事实、不含transport key；后续修订不改变旧create/correct回执重放。
- `reads.ts`按owner提供最多10条+lookahead、64KiB UTF8修订历史。历史时间/证据/正文来自对应修订，状态/head/history同快照；游标不能绕过当前正文有效性检查。
- 受保护PATCH与GET revisions薄路由沿用签名预登记owner、同源JSON写入、受限fatal UTF8与no-store；旧CAS409，缺失/他人历史同样404，canonical正整数游标，无Bearer回退。
- 新增13项核心和3项HTTP测试。初始核心0/9与HTTP6/9失败后通过；自审发现损坏head可被分页绕过，回归先12/13失败、修复后13/13通过。全套101/101，类型检查与内存D1验证通过。
- `0004_correction_authority.sql`按create/correct分别校验实时scope，未知操作拒绝。不seed用户，不修改旧公开records/snapshots或Gemini组件。
- 删除只有准备边界，**物理删除、无正文拒绝标记、防复活与过滤恢复尚未实现**；真实私人导入仍禁止。作者自行审查，不冒充独立模型审查。

## C2-B既有交付（保留）

- `lib/learning/reads.ts`：真实principal与细粒度scope；同一主库D1 batch复查active owner/grant及权限、版本、内容。返回current_revision白名单DTO，缺失与他人事件同结果；缺失/损坏当前修订脱敏失败，不返回旧正文或payload内部字段。
- 有限context按用途取最近事件，版本同快照，最多64KiB UTF8；裁剪后证据/来源保持一致。发生时间未知保留NULL，latest取真实已知事件时间；聊天未接、大纲/计划未配、尚未评估及遗漏/未知范围如实说明，无假能力或计划。
- `lib/learning/http.ts`和`app/api/studio/events`、`events/[event_id]`、`context`薄路由：每请求签名Access+预登记owner，只限浏览器所有者，不接受Bearer grant回退。POST同源、JSON、受限流及fatal UTF8；保存201、重放200、冲突409、无身份401、权限403、不可见404、过大413、故障503，no-store、脱敏错误。
- 新增`tests/helpers/learning-fixture.mjs`及16项reads/http测试，使用真实内存SQLite与合成RSA身份。读取/HTTP原始用例先失败后实现通过；流取消异常不应覆盖413回归先503失败再修复。另测同快照版本一致性及缺当前修订拒绝。
- 本批不改auth、atomic-save、schema、contracts或已有public/UI行为。保存服务、outbox和学习日仍沿用C2-A已核验实现；outbox行不代表后台已执行。

## C2-C运行验证范围

仅内存Miniflare/workerd D1绑定验证签名owner HTTP保存→纠正→重放→当前/历史，原create回执重放、correction-only grant、同/异key并发、旧CAS、丢失响应、五个必要写入10种ABORT/IGNORE整体回滚、7种grant竞态/重放拒绝、owner禁用/隔离、历史分页与损坏head拒绝。0004重复应用/FK检查通过，旧records/snapshots均0行。所有持久化关闭、port=0且runtime已释放。

脚本在Node调用真实服务handler与D1绑定，不是框架route.dispatch、完整构建或真实浏览器网络验收；不加载Wrangler、Secret或共享库。C2-B回读/context原验证保留，不据本批扩大其边界。

任务本地归档：`.ccg/tasks/archive/2026-10/wayneo-c2c-corrections/`，附plan/requirements/progress/review/verification、runtime脚本与deletion-readiness.md。禁止提交优先于归档提交惯例；保留C2-B旧归档。

## Gemini v3接收与缺口

实际Chrome DOM状态测试和三个截图确实交付，保留`.ccg/tasks/g3-studio-verification/`全部历史产物；不是私人API/ChatGPT/手机实测。报告称12项，summary实际13项。

1. 成功回执夹具缺v1的event_id/revision/received_at/data_version/processing_status/replayed等字段。当前容器只检查saved与receipt_id，仍可能在不完整回执时清稿；受保护挂载前由Codex补齐完整运行时校验。
2. 连击只断言disabled，没有断言submitCallCount=1；同一轮React状态提交前的锁也需实际测试。
3. 焦点测试只以按钮高度通过；summary记录outline-style=none。没有证明真实键盘导航或focus-visible。减少动画仅检查matchMedia存在/颜色。
4. 溢出断言来自默认747px布局，三个截图不等于每个视口有断言。需逐视口检查长文本/代码、控制尺寸、焦点和详情关闭。
5. runner在FAIL/UNKNOWN时没有强制非零退出，且没有独立Chrome profile；下一批用独立验证产物补齐，不篡改原报告。
6. 当前适配器两次context分别加载概览/列表且直接展示unknown_ranges机器标签，来源遗漏不能统一叫未覆盖时间段；挂载时需保证一致、准确和可读。

以上是明确的下一批未验收事项，不声称本批已修复，也不据此抹掉已交付的组件和浏览器证据。

## 下一步与目标距离

下一本地批次落实物理删除、无正文重放拒绝和隔离恢复过滤，验证旧回执/来源/任务不复活内容及单调版本。然后补完整前端回执校验、同步提交锁、单次context准确映射与受保护Studio本地保存/回读/失败重试、框架及浏览器验收。Codex自行实施与自审，不等Gemini，也不另叫模型。

最小私人可用闭环正在接近：身份、原子写入/纠正、受保护HTTP、私人读取/context/历史和UI组件已有本地交付；仍需删除/过滤恢复、页面挂载与集成及真实身份/手机验收。远程隔离资源、Access/OAuth授权、备份保留策略、生产迁移/发布仍需单独授权，不在代码里绕过；study-test仍是生产别名。

完整最终目标仍有较大工作量：知识档案/大纲/目标与现实安排、证据评估、唯一当前计划、公开白名单/撤回、任务执行/有限重试、私人备份恢复/删除策略与成本控制大多未实现。阶段不等重，不给未经测量的精确百分比或时间承诺。

本记录不启用后台监听/定时任务，也不增加生产权限。最新范围见[实施计划](../implementation-plan.md)与[项目约定](../../AGENTS.md)。
