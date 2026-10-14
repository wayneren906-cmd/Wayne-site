# 邮箱管理员登录

公开 Index、Journal、Studio 均允许游客浏览。已有管理员使用 `/login` 登录；管理总览、私人记录、项目和目标，以及公开手记编辑接口，统一由服务端验证邮箱会话。旧 Access JWT 不提供网站权限，旧登记接口返回 410。

账号存于 `admin_accounts`，首位管理员为 owner，后续添加的账号为 admin；所有账号指向同一 owner 数据空间。只有 owner 可以读取管理员列表和添加管理员。没有访客注册、自动提升角色、邮箱发信或密码找回服务。后台停用账号或推进 auth_version 后，旧会话不再有效；暂未提供账号停用与密码修改界面。

密码使用随机 16 字节盐及 scrypt N=16384、r=8、p=5、32 字节输出；比较使用 timingSafeEqual。实现使用现有 Node 兼容运行时，没有新增或升级依赖。参数依据 [OWASP 密码存储指南](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) 的 scrypt 配置档位；运行时能力依据 [Cloudflare node:crypto 文档](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)，并在本项目生成的实际 Worker 中验证。

随机 32 字节会话令牌仅放入 `__Host-wayneo_session` Cookie，数据库仅保存 SHA-256 摘要。Cookie 设置 HttpOnly、Secure、SameSite=Strict、Path=/，会话有效期 8 小时。重复 Cookie、过期会话、停用账号、版本不一致和停用数据所有者均拒绝。登录成功替换当前浏览器的旧会话；退出删除服务端会话并清空 Cookie。成功登录时清理过期会话和旧限速元数据，没有新增 Cron。

登录 POST 要求同源 Origin 和 JSON，正文限制 8KiB。邮箱规范化为小写，密码不裁剪；错误密码和不存在邮箱返回同一错误。每 10 分钟限制单邮箱 6 次、单 IP 30 次；限速键经过摘要处理，计数在 D1 中原子推进。首位管理员添加账号再次在写入时核对有效会话、角色和账号状态；私人内容读写使用事务内会话守卫。所有认证响应禁止共享缓存，按 Cookie 区分。

首位管理员通过 `scripts/prepare-admin-bootstrap.mjs` 从标准输入生成仅含盐及密码哈希的本地方案，输出只能位于忽略的 `data/`。`adminBootstrapStatements` 在一个 batch 中检查空账号目标并写入 owner 与账号，任何失败或忽略都会回滚。没有把首位邮箱、密码或哈希写入迁移或源码。

上线顺序：部署并应用 0007/0008；按已批准的本地方案原子初始化首位管理员；先验证邮箱登录和私人权限；再移除精确匹配本站 8 条路径的旧 Access 应用；最后验证游客访问、邮箱登录、退出及匿名 API 拒绝。旧 Access 的可复用策略不删除。移除旧保护后，不能直接回滚到只认 Access JWT 的 Worker；应先恢复已审核的旧应用，或保留支持邮箱会话的版本。

内容备份不携带登录密码哈希、会话或限速元数据；隔离恢复要求这些表为空，并保持 owner 停用，之后独立重新配置登录。生产初始化、应用移除及真实密码登录尚未执行，部署须获得明确授权。
