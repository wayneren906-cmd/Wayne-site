# Studio 本地闭环验证

2026-10-14，C2-E。本地代码已交付，未部署或启用真实私人导入。

## 实现

- `/studio` 动态服务端页面在渲染客户端前验证签名 Access、预登记 owner 和 active 状态；验证失败只展示登录提示，不传入私人数据。不新增公开导航。
- `StudioEntry` 保持稳定的同源适配器。一次 context 同时更新概览和列表；并发读取按代次拒绝旧结果，失败清除旧列表并显示错误。
- 客户端对完整回执、事件、context 和证据引用做运行时验证。部分回执不显示保存成功或清稿；重试复用原键，改载荷换键；同步 ref 防止同一轮连续提交。保存已成功而刷新失败时保留已保存提示，列表单独显示错误。
- 原生浏览器 fetch 已绑定 globalThis，修复实际浏览器 Illegal invocation；请求拒绝重定向、不使用缓存、同源凭证，支持超时和取消。
- 覆盖范围以中文说明聊天未接入、能力尚未评估、时间未知/记录裁剪。概览时间明确为最近已知学习时间，不冒充内容更新时间；不承诺已有自动规划。
- 引用现有 CSS、字体和主题变量；44px 控件、focus-visible、减少动画、详情打开焦点与 Escape/关闭后返回焦点。补充内容上限2000字。
- 静态组件测试改用忽略的 `tests/.generated`，不再覆盖 Gemini 历史 compiled 产物。

## 实际证据

- 全套117/117测试，非增量 TypeScript noEmit通过。新增5项安全/闭环测试覆盖不完整回执保稿、重试键、单次context、重复提交、过期响应、签名owner真实handler/SQLite读写和无效context拒绝。
- `tests/studio-browser.mjs` 用独立Chrome profile、独立Vite客户端构建、127.0.0.1 HTTP和内存SQLite。Node服务仅注入合成签名身份，调用实际Studio HTTP handlers；未加载生产Vite/Wrangler/Secret或共享数据库。
- Chrome真实输入、连续提交、503失败留稿重试，以及提交已持久化但仅返回部分回执后的幂等恢复通过。4次POST只创建2事件；3次context包含初始及两次成功刷新。
- 320/390/1280各自断言无横向溢出、控件高度>=44px、减少动画为none；CDP真实Tab产生solid焦点，Escape关闭详情并返回事件按钮。截图与summary在忽略的`tests/.generated/browser/`。
- 管理沙箱内Chrome CDP Page.enable两次超时；自动审批允许相同隔离测试在沙箱外运行后成功。没有修改生产权限或安全配置。

## 未验证与下一步

本批客户端构建不是整个应用构建。浏览器经Node调用实际HTTP handler，**不是Vinext Worker框架路由派发或真实Access登录**；移动视口不是实际手机。既有内存D1证据属于前批，未声称本轮浏览器连接D1。

下一批先完成不影响共享dist/数据库的完整框架构建、页面保护与路由派发验证。之后在获明确授权的独立远程Worker/DB验证真实Access、MCP/OAuth与常用手机。私人备份检查点/保留策略、完整导入和公开投影仍有独立门槛。

未修改依赖/生产配置/定时任务，未提交推送、线上迁移/写入或部署。没有调用其他模型或子代理。
