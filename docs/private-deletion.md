# 私人事件删除与隔离恢复

更新：2026-10-14，Asia/Shanghai。C2-D 本地实现；未部署，未使用真实私人数据。

## 已实现

- `DELETE /api/studio/events/{event_id}`：经签名验证且预登记的 owner、同源 JSON、64KiB 流限制、no-store。现有 integration grant 没有删除权，不新增 scope。
- 请求为 `{schema_version:1,idempotency_key,expected_revision}`，不接收或存储删除原因/正文。成功返回 `{event_id,deleted_revision,data_version,deleted_at,deleted:true,replayed}`，首次和同键重放均为 HTTP 200。
- 缺失与他人事件均 404；旧 revision 为 409；同删除键换目标或 revision 为 409。重试必须复用原键与原 revision。已禁用 owner 的删除及回执重放均被拒绝。
- 单个 D1 batch 推进 owner 版本、保留无正文标记和旧凭证操作键，再清理任务、回执、全部修订和事件。CAS/owner 状态在事务内复查，每项必要写入及整组清理都有回滚守卫。
- create/correct 在预检查与失败恢复时拒绝旧事件、旧键、同 owner/source 的延迟提交；数据库触发器保护竞态。当前读取、历史、context 排除删除标记下的旧正文。未来执行器仍须使用版本/标记守卫；当前没有任务执行器。

## 隔离恢复服务的范围

`filterRestoredLearningData` 是可信离线服务，没有 HTTP 路由、导出器或生产执行脚本。调用者负责确认目标真正隔离、关闭读取和任务，并提供从备份外存活的完整删除检查点。`isolated:true` 是调用前提声明，不是对数据库隔离的自动检测。

检查点包含 `schema_version:1`、每个恢复 owner 的 `data_version` 高水位、`deleted_learning_events` 标记和 `deleted_learning_keys`。只接受规定元数据，不保存正文 hash、修订原因或模型结果。当前单批限 100 owner / 1000 标记 / 10000 键；超限拒绝，不截断。

服务原子合并检查点；不一致标记或键拒绝并回滚。过滤旧事件 ID 和同来源的其他事件 ID，补存备份中发现的旧重试键，再清理相关正文。版本升至本地/存活检查点高水位之上；移除旧任务，旧租约不能继续使用。无删除标记的 owner 也必须提供高水位。此服务不替代完整私人导入、备份认证、权限撤销恢复或任务重新生成流程。

## 必须保留的边界

- source_record_id=null 时，不同新键无法可靠识别为同一事实；不以保存已删除正文/hash 来猜测。原键仍拒绝，有明确 source ID 则不自动复用。
- 标记/重放键当前不自动过期。真实私人导入前仍须确定存活检查点的独立存储、访问控制、保留与备份策略；本批没有创建资源或调整费用/调度。
- 仅清除当前新私人数据表；原公开 records/snapshots 不是新事件的副本，保持原样。未来派生正文、附件、公开投影与撤回须另做传播。
- 旧备份和 D1 Time Travel 不等于立即物理擦除；离线过滤测试不代表生产备份副本已清除。

## 实际验证

- 全套 Node 测试 112/112、非增量 noEmit 类型检查通过。
- 新增 11 项行为测试：全部修订/回执/任务清理、鉴权、CAS、两类并发、响应丢失、来源/键防复活、删除标记读取屏蔽、同来源异 ID 恢复、版本高水位、HTTP 边界。
- SQLite 删除与恢复各 14 种 ABORT/IGNORE 注入均整体回滚。
- `tests/learning-deletions-d1.mjs`：仅内存 Miniflare D1，重复迁移、多修订清理、删除 14 种回滚注入、并发重放、来源拒绝、隔离恢复和外键验证通过。
- 未运行应用构建、框架派发、浏览器/真实 Access/ChatGPT/手机验证；未加载生产配置/Secret、迁移共享库或生产库、提交/推送/部署。
