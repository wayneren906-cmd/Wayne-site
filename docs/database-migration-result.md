# 生产数据库迁移完成

2026-10-14，C2-I。用户在明确的四项迁移范围后回复“确认”，本轮已执行并核验。

## 执行范围

目标为生产D1 `wayne-learning`，UUID与既有`wayne-site`的DB绑定及源配置一致。仅执行`0002_learning_events.sql`、`0003_ingest_outbox.sql`、`0004_correction_authority.sql`、`0005_private_deletion.sql`及对应`d1_migrations`记录。

没有Git提交推送、Worker代码部署、资源创建、DNS/费用/Access权限/Cron调整、真实owner或grant登记、私人内容导入、旧表写入/删除。数据库结构上线不代表Studio或ChatGPT功能上线。

## 过程与证据

- 执行前重新读取现场schema/ledger/业务数量/Worker绑定，并通过本地预检；四文件SHA256与获确认时完全一致。旧记录仍4条、快照5份、ledger仅0001。
- 刷新公开应用数据备份并在内存恢复核对；路径为Git忽略的`data/pre-migration-confirmed-2026-10-14`。这是公开应用数据备份，不是D1完整导出或未来私人备份。
- CLI没有登录，使用既有已认证Cloudflare连接；账号身份与目标成员关系已读核对，具备该账号执行权限。未要求用户再次登录或提供凭证。
- 按已安装Wrangler迁移实现的“文件SQL+ledger INSERT”方式，通过D1 query API逐文件提交；每次加只读迁移前缀守卫，逐项检查所有返回语句success和错误数组，失败即停。
- 四文件API请求均success=true / HTTP200，时间按迁移记录为北京时间2026-10-14 01:54:00–01:54:31。

## 生产核验结果

| 项目 | 结果 |
| --- | --- |
| 迁移记录 | 0001–0005全部存在，待迁移为空 |
| 私人表 | users、integration_grants、learning_state、learning_events、event_revisions、ingest_receipts、processing_jobs、deleted_learning_events、deleted_learning_keys，共9表全部0行 |
| schema | 本地重建比较完全通过，指纹`a80fe03115878058bf6747ebc041f421b7297afac837862628ae87911866a903`与演练一致 |
| 外键 | PRAGMA foreign_key_check返回空数组 |
| 旧数据数量 | records=4、snapshots=5 |
| 旧数据内容 | 迁移后重新导出，与迁移前records及每份snapshot的全部公开字段逐值一致 |
| 旧网站读取 | `/`、`/learning`、`/projects`、`/api/records`、`/api/snapshots`均HTTP200 |

检查中的复合UNION计数触及线上SQLite限制，未产生写入；改为标量子查询后计数和外键核验成功。没有因核验请求失败重放迁移。

完整API结果、schema和迁移后应用数据导出在忽略的`data/post-migration-confirmed-2026-10-14`。文件中不保存Secret或私人内容。本批没有修改应用/迁移源码，未重复此前已通过的130项代码测试；本批证据是上述直接生产核验。

## 剩余工作

新表已经在生产建立，但尚无真实所有者登记、私人数据或新Worker代码上线。Studio部署、真实Access/Google/OIDC、MCP/OAuth/ChatGPT/手机、备份密钥/独立检查点/保留策略均仍需按范围授权和验收。本次“确认”只授权四项迁移，不扩展为部署或其他线上变更授权。
