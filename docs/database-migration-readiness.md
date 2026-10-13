# 数据库上线准备（历史）

最新结果：用户确认后，2026-10-14已完成生产0002–0005及ledger；9私人表为空，旧4日志/5快照逐值一致，schema/FK/公开HTTP核验通过。详见[迁移结果](database-migration-result.md)。以下为执行前准备记录，不再表示迁移待授权。

2026-10-14，C2-H。已完成只读现场核查、旧公开数据备份和隔离迁移/恢复演练；未执行任何线上DDL或写入。

## 执行对象与现场

- 生产 Worker：`wayne-site`，DB 绑定指向生产 D1 `wayne-learning`，UUID与源wrangler.jsonc一致。
- 现场sqlite_master只有业务表records/snapshots，加Cloudflare内部表和d1_migrations；没有新私人表。迁移记录仅`0001_initial.sql`。
- 本轮生产只读API返回records=4、snapshots=5；SQL元数据`changed_db=false`、`changes=0`、`rows_written=0`。没有读取正文或Secret。
- 另外通过公开HTTP接口导出旧内容到Git忽略的`data/pre-migration-2026-10-14/legacy-export.json`。导出前后记录和快照目录一致；本地恢复逐条核对正文、版本与时间通过。这是当前公开应用数据备份，不是生产D1完整导出或私人备份。

## 待执行的四项迁移

| 文件 | 影响 |
| --- | --- |
| 0002_learning_events.sql | users、integration_grants、learning_events、event_revisions、learning_state及相关索引 |
| 0003_ingest_outbox.sql | ingest_receipts、processing_jobs及权限/版本触发器 |
| 0004_correction_authority.sql | 替换私人回执触发器，按create/correct区分权限 |
| 0005_private_deletion.sql | deleted_learning_events、deleted_learning_keys及防复活触发器 |

总计9张新私人空表。没有seed，不建立真实owner或grant，不修改旧records/snapshots结构/正文。迁移记录新增4项。迁移本身不发布Worker代码，也不启用Studio、ChatGPT接入或真实私人导入。

本批执行申请只涵盖上述4文件和迁移记录，不包含Git提交推送、Worker部署、资源创建、DNS、费用、Access权限、定时任务、私人数据导入或旧表删除。`pnpm deploy`会同时构建、迁移、部署，不作为这个单独迁移步骤的执行入口。

## 预检与演练

- `scripts/migration-preflight.mjs`只读取本地元数据JSON，不读取数据库/凭证或请求Cloudflare。按迁移前缀重建预期schema，拒绝缺表/额外表/结构漂移/未知或乱序ledger，生成文件SHA256、最终schema指纹与待执行名单。
- 生产只读元数据基线保存在被忽略的`data/pre-migration-2026-10-14/schema-baseline.json`；其预检准确得到0002–0005四文件。执行前重新读取现场并核对文件hash，不使用旧基线跳过漂移检查。
- 新增4项行为测试；全套130/130、非增量TypeScript noEmit通过。
- SQLite保留包含引号/中文/换行的合成4条旧日志与5份快照，全迁移前后逐值一致；新私人表0行，FK正常。
- 实际内存D1重现0001+ledger及4/5合成旧数据；0003注入SQL错误后DDL和ledger整体回滚，0002保持，后续可接续。完成后旧数据逐值一致、9表为空、ledger无待迁移/FK正常。
- 真实公开数据导出在内存SQLite恢复并应用4项新迁移，所有旧内容/版本/快照/时间逐值核对通过，没有在共享或生产库恢复。

## 执行与失败处理

获得明确的生产迁移授权后，先重新核对目标账号、DB绑定、迁移前缀、schema与四文件hash；刷新公开应用备份并验证恢复。采用现有安装版本的单独D1迁移流程，逐文件记录结果，不调用部署脚本。

执行失败后停在失败文件，核对ledger与实际schema，再接续剩余文件；不通过删表或回滚旧数据“清理”。已完成文件可能保留。迁移后核对9表空、旧数据完整、FK正常、ledger0001–0005与旧公开HTTP读取。

生产迁移仍可能有短暂数据库锁/延迟；目前没有线上执行，因此不声称零停机或生产迁移已成功。生产恢复如果需要改写旧数据，另行明确授权，不能因本轮迁移许可自动执行。

执行边界来自项目[AGENTS.md](../AGENTS.md)第5节：未经明确授权，不执行远程数据库迁移。官方迁移流程见[Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)；本项目仍使用已安装的Wrangler版本，不自动升级。
