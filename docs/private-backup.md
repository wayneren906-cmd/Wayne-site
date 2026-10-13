# 私人备份与恢复：本地服务

2026-10-14，C2-G。加密导出与空目标隔离恢复已实现并验证；没有上线备份入口或配置存储提供方。

## 服务边界

`exportPrivateLearningBackup` 只接受经验证的 active owner；integration grant、伪造身份和停用 owner 无权导出。鉴权和各表读取位于同一D1 batch快照。返回加密的私人备份、单独加密的无正文删除检查点和版本；不读取/写入文件、不创建HTTP端点。

完整私人备份涵盖该 owner 的 users、integration_grants、learning_state、learning_events、event_revisions、ingest_receipts、processing_jobs、deleted_learning_events、deleted_learning_keys。公开records/snapshots不属于此格式。导出前检查列、所有者、来源/当前修订、完整前序修订、回执/任务关系和版本；不截断损坏或超限数据。

加密使用Web Crypto AES-256-GCM、新随机96bit nonce，格式版本和用途作为关联认证数据。32字节密钥由可信调用者提供，不进入数据库、源码、日志或返回值；备份与检查点互换、密文篡改或错误密钥均拒绝。当前总计最多150行、明文最多4MiB；这是首版保守离线批次上限，不代表所有账号的Worker/D1生产额度。

## 恢复

`restorePrivateLearningBackup` 仅接受已应用schema、全部私人表为空的隔离目标，可信调用者显式声明`isolated:true`、expectedOwnerId与minimumCheckpointVersion。声明不是隔离环境探测器。检查点必须从旧备份之外存活，并达到可信外部高水位；服务无法凭旧文件自动识别是否存在更新检查点。

在一个D1 batch内完成空目标守卫、原始事件/修订/回执导入、删除检查点合并与过滤、版本推进及权限关闭。为遵守既有历史回执的事务内授权/版本触发器，临时导入权限和旧版本只存在于此事务；不删除或禁用触发器。提交结果是owner disabled、所有旧grant revoked、无旧任务。任务元数据保存在加密备份中用于核对，但不恢复旧租约或重新执行任务。重新开放owner和新工具授权是独立明确操作。

已删除事实、修订、回执及同来源重试被清除/拒绝，未删除事实保持内容、关联与修订。版本高于备份和存活检查点。任何必要写入失败/IGNORE使整个事务回滚；非空目标拒绝覆盖。响应丢失可能发生在已完整提交之后，此时目标仍关闭权限；不可把失败响应当作空库或自动再次覆盖，须在隔离目标核对最终状态。

## 验证

- 新增9项行为测试；全套126/126、非增量TypeScript noEmit通过。
- SQLite验证原记录/修订/回执完整核对、加密不含正文/内部标识、nonce更新、旧备份防复活、密文/密钥/用途/owner/检查点/隔离拒绝、空owner、快照内权限变化、损坏历史、18种ABORT/IGNORE回滚、历史窄/撤销grant、响应丢失关闭状态。
- `tests/learning-backup-d1.mjs` 使用实际仅内存D1：22种ABORT/IGNORE整体回滚、grant关联历史导入、旧备份加新删除检查点过滤、版本3/4→5、保留1条无关事件、无旧任务/FK正常、owner及旧grant拒绝；显式重新启用测试owner后旧grant和已删除来源仍拒绝。
- 合成数据只在内存处理，没有把明文备份、密钥或密文备份另存文件。测试不加载生产Wrangler配置、Secret或共享数据库。

## 仍待完成

本批是可信离线服务，不是完整生产备份产品。密钥保管与轮换、独立检查点存储/可信高水位、备份保留/过期、访问控制、定时导出、完整操作界面和线上恢复演练尚未配置；真实私人导入仍禁止。旧备份和D1 Time Travel不是立即逐事件擦除。

真实Access/MCP/OAuth/ChatGPT/手机、独立远程环境与生产发布仍待授权及验收。没有升级依赖、修改生产配置/权限/费用/Cron、提交推送或线上写入。
