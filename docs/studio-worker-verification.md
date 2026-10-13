# Studio 完整 Worker 验证

2026-10-14，C2-F。完整应用在隔离目录构建，实际生成的 Worker 在本机 workerd 中验证通过。未部署或使用真实私人数据。

## 交付与隔离

- `tests/studio-worker.mjs` 仅复制 app/lib/worker/migrations/public 和必要构建文件到独立 `tests/.generated/worker-{timestamp}`。复用已安装依赖，Vite缓存、Wrangler日志、dist、.next和本地配置全部留在测试目录；不清理共享dist。
- 测试配置没有生产账号/域名/Cron/真实DB/Secret；合成 D1 ID，禁用远程获取和指标。本批保留生产兼容日期，不升级依赖。
- `tests/helpers/studio-worker-environment.mjs` 显式装载完整生成模块，提供ASSETS和仅内存D1。出站请求仅允许合成Access公钥端点并返回本轮公钥；其他目标拒绝，不真正发出身份网络请求。
- `tests/studio-worker-runtime.mjs` 通过实际Vinext路由分发，不在Node里直接调用Studio handler。`tests/studio-browser.mjs --worker` 在本机桥接完整Worker响应和静态资源，再由独立Chrome打开服务端渲染的`/studio`。
- 修复真实完整页面中退出链接的触控高度和键盘焦点。测试资源采用与原配置一致的静态资源优先顺序；早期测试的user-worker-first导致资源404，修复仅作用于测试配置。

## 实际结果

- 完整构建5阶段成功，包括RSC/SSR/客户端。依赖内部有既有动态导入重复警告；不是构建失败。
- Worker运行验证23个请求：匿名私人API401；匿名/伪造页面不渲染补充表单；经签名owner SSR渲染真实Studio且private/no-store缓存策略通过；创建201/重放200/回读200/纠正201/历史200/context200/删除200。
- 删除后当前/历史404、旧提交409；旧CAS409；跨源写入403；超大请求413；同一有效签名身份降为member或停用后403，页面只展示拒绝提示。
- 私人内容和event_id不出现在旧公开records/snapshots API；旧公开表无新增行，D1外键检查正常。
- Chrome完整链路通过：SSR资源200并完成客户端初始化；初始概览/列表单次context；连续提交仅1 POST；503保稿原键重试；持久化后部分回执保稿并原键恢复。4 POST仅2事件，初始及两次成功刷新共3 context。
- 320/390/1280逐视口无横向溢出，所有按钮/链接>=44px，减少动画none，真实Tab的focus-visible为solid。详情打开获得焦点，Escape关闭并返回事件按钮。
- 全套117/117与非增量TypeScript noEmit通过。运行摘要在最新隔离目录`runtime-summary.json`；浏览器summary与截图在忽略的`tests/.generated/worker-browser`。

## 复验

```sh
node --experimental-strip-types tests/studio-worker.mjs
node --experimental-strip-types tests/studio-worker-runtime.mjs
node --experimental-strip-types tests/studio-browser.mjs --worker
```

首次命令生成最新隔离目录，后两项只复用该目录。源码改动后必须重新完整构建，不用旧目录代替新验证。Chrome在管理沙箱内CDP可能超时，本轮经自动审批在沙箱外运行相同隔离测试；没有改变生产权限。

## 边界与下一步

身份为合成签名JWT/JWKS，浏览器桥接注入合成身份；**没有测试真实Access登录、Google/OIDC、MCP/OAuth、ChatGPT账号或常用手机**。本机完整链路不是线上部署验收。

接下来可按授权准备独立远程Worker/DB和Access策略、验证真实所有者及ChatGPT接入。当前测试域名仍是生产别名。私人备份检查点独立存储/保留策略、完整导入和公开投影/撤回仍需补齐，不能因本批通过而开启真实私人导入。

未改生产配置、依赖、费用、权限或Cron；无提交推送、线上迁移/写入/删除或部署。保留所有历史产物。

测试配置参照[Cloudflare Vite API](https://developers.cloudflare.com/workers/vite-plugin/reference/api/)、[Miniflare fetch](https://developers.cloudflare.com/workers/testing/miniflare/core/fetch/)及当前安装版本的配置类型；运行行为以本轮直接结果为准。
