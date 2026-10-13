# Studio 阶段上线结果

2026-10-14，C2-K。用户明确授权 main 提交推送、生产 Worker 发布与 Studio Access 保护。本轮没有登记或启用真实账户，没有写入私人学习数据。

- GitHub 提交：`8e043e9c8f7098a1ca149a83d60fdfbe9953f8bd`，已推送 main。精选 82 个文件；私人 data、生成目录、截图、CCG 产物未提交。其他历史未提交文件保留。
- [Deploy website](https://github.com/wayneren906-cmd/Wayne-site/actions/runs/38447004480) 与 [Check](https://github.com/wayneren906-cmd/Wayne-site/actions/runs/38447004556) 均成功，包含测试、类型检查、生产构建与发布。
- 当前 Worker 100% 版本：`cd3f6cfe-8a22-476b-ac5f-791d26fb190b`，北京时间 02:29:12 发布。旧版本 `f5001468-59ee-4f29-92ed-930a866eaecf` 可用于必要回退，本次未触发。
- Access 先新增两个域名的 studio/api/studio 四路径，再推送发布。回读确认旧路径、owner-only 策略、audience、idP 与 24h 会话保持。
- 生产 DB/ASSETS/身份变量和原 Secret 名称保持。部署后 users/learning_events 均 0，ledger 5 项、旧 records 4 项/snapshots 5 项，外键正常。旧两个公开 API 的发布前后响应哈希一致。
- 两个域名的首页、learning、projects 均 HTTP200，引用的 CSS/JS 全部 HTTP200；共 12 个 Studio/旧管理匿名入口均跳转既有 Access 登录页。
- 本地 136/136、非增量类型检查、隔离完整构建、28 个实际 Worker 请求、Chrome/Worker/内存 D1 保存重试与三个视口检查通过。初次 pnpm exec tsc 本机命令解析失败，改为 Node 调用已安装 TypeScript 后通过；CI pnpm typecheck 也通过。

[在线 Studio 预览](https://wayneo.dev/studio) 已在 Codex 浏览器打开，当前等待用户自行完成邮箱验证码登录。签名验证通过且未登记的配置所有者可查看空数据只读界面；输入/提交禁用，不伪造学习成果、不自动创建账户。member/disabled、匿名或伪造身份仍拒绝，私人 API 未放宽。

真实身份登录后的界面和常用手机仍待用户验收，本轮没有读取 JWT、验证码或 Secret。后续真实 owner 登记/启用、备份配置和私人导入另行明确范围；ChatGPT、评估规划及自动运行仍未完成。

总体粗估 53%–58%，本批约 +3 个百分点。生产发布成功不等于全目标完成。
