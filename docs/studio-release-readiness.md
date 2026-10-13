# Studio 上线准备

2026-10-14，C2-J。本批完成代码与发布预检；尚未提交、推送、发布或修改 Access。

2026-10-14 C2-K：用户已明确授权 GitHub main 提交推送、生产发布和 Studio Access 保护。上线执行中；Access 四路径扩展已成功回读，旧策略/audience/idP/会话设置一致。发布前本地 136/136、非增量类型检查与完整构建通过，实际 Worker 路由检查增加到 28 个。真实账户未登记的签名所有者可查看空数据的只读 Studio，输入与保存禁用；member/disabled 或无效身份仍被拒绝，私人 API 未放宽。部署结果以本轮实际核验为准。

生产数据库已完成 0001–0005，9 张私人表为空。生产 `users` 没有登记所有者。现有 Access 应用只保护两个域名的旧管理页面和管理 API，尚未覆盖 Studio。数据库迁移授权不覆盖下述操作。

## 待批准的发布范围

通过现有 main 分支的 GitHub Actions 发布 `wayne-site`。提交范围由 `scripts/release-preflight.mjs` 生成文件清单与 SHA-256；包含 Studio、私人服务、迁移、相关测试及文档，排除私人 data、生成目录、截图和历史 CCG 产物。推送前重新核对远端 main 与本地差异，保留其他未提交文件。

先扩展既有 `Wayne site admin` Access 应用，再发布代码。保留旧路径、现有 owner 邮箱策略、应用 audience、身份提供方和会话设置，新增以下四个 public destination：

- `wayneo.dev/studio`
- `wayneo.dev/api/studio`
- `study-test.wayneo.dev/studio`
- `study-test.wayneo.dev/api/studio`

路径覆盖其子路径。使用 destinations 时，旧 self_hosted_domains 字段不会决定匹配范围，操作后应重新读取 destinations 验证。依据：[Cloudflare 自托管公共应用](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)。不扩大为整站登录保护。

保留现有 Worker 的 DB、ASSETS、配置变量、Secret 名称、两个域名和两个 Cron。现有部署脚本会检查 D1 待迁移项；本批迁移文件已经上线，发布前再次检查 ledger 和文件哈希，存在漂移时停止。当前 100% 版本 `f5001468-59ee-4f29-92ed-930a866eaecf` 作为 Worker 回退基线；不回滚已完成的数据库迁移。发布失败时先验证旧版本和公开页面，Access 扩展可以保留以继续保护新路径。

## 所有者身份准备

新增 `GET /api/studio/registration`，只接受经过签名、issuer、audience、期限和配置 owner 邮箱验证的 Access JWT。身份 subject 不能从邮箱猜测。接口只读取 users；缺少登记时返回默认 disabled 的待确认提案，不插入账户、不启用权限，也不返回 JWT 或学习正文。已有 member/disabled 身份不会升级。

发布后需要所有者通过实际 Access 登录获取提案，使用受保护的操作渠道核验。不要在聊天中粘贴 JWT 或 Secret。真实 owner 登记及启用属于后续单独生产写入范围，本次发布申请不包含它。没有登记前 Studio 私人读写仍拒绝访问。

## 验证与剩余事项

- 全套 136/136 测试与非增量 TypeScript 检查通过。
- 隔离的完整应用五阶段构建通过，实际 workerd/内存 D1 验证 26 个路由请求。
- 新入口验证未登录拒绝、有效签名仅返回提案、users 保持零新增、未登记身份 context 仍 403。
- 本批没有改页面视觉；此前 Chrome 多视口、键盘与完整 Worker 闭环证据保留。
- 未验证生产新版本、真实 Access 身份、常用手机或 ChatGPT 接入；尚未配置生产私人备份密钥、独立检查点与保留策略，不开启真实私人导入。

总体完成估计 50%–55%，本批约增加 2 个百分点。这是按功能阶段的粗估，不能作为已上线比例。
