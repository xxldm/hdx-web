# HDX Web

本目录是 HDX Web 端 Nuxt 应用。Web 第一阶段架构已由 `docs/adr/0003-web-nuxt-architecture.md` 接受。

## 技术栈

- Nuxt 4.x，默认 SSR。
- Nuxt UI 4.x，根组件使用 `UApp`。
- `@nuxtjs/i18n`，默认 `zh-CN`，备用 `en-US`，使用内部状态切换语言，URL 不随语言变化。
- Pinia，store 放在 `app/stores/`，按领域拆分。
- Zod，负责 runtime config、Nuxt server handler、表单输入和后端响应边界校验。
- pnpm，仅在 `apps/web/` 内使用。

## 入口与边界

- 页面入口：`app/pages/index.vue`。
- 全局样式：`app/assets/css/main.css`。
- Web API 边界：`server/api/hdx/v1/**`。
- 后端 gateway 默认地址：优先读取 `NUXT_BACKEND_BASE_URL`，其次读取 `HDX_BACKEND_BASE_URL`，默认值为 `http://localhost:18080`。
- 认证中心默认地址：优先读取 `NUXT_AUTH_BASE_URL`，其次读取 `HDX_AUTH_BASE_URL`，默认值为 `http://localhost:18082`。
- 本机 all-in-one 令牌可通过 `NUXT_BACKEND_LOCAL_TOKEN_HEADER` 与 `NUXT_BACKEND_LOCAL_TOKEN` 注入，只能留在 Nuxt server 私有 `runtimeConfig` 中。
- Web 登录态使用 Nuxt server 加密 `HttpOnly` cookie session。浏览器只持有同源 cookie 和 CSRF token，不能读取 access token 或 refresh token。

浏览器不得直接访问后端地址，也不得读取本机令牌。浏览器只调用 Web 自身的 `/api/hdx/v1/**`。

## Web BFF 登录态

当前已提供最小 BFF 接口：

- `GET /api/hdx/v1/auth/session`：返回当前 public session 和 CSRF token；如果 access token 临近过期且 refresh token 仍有效，会自动刷新 Web session。
- `POST /api/hdx/v1/auth/login`：校验 CSRF，调用认证中心 `/api/auth/login`，把 token 写入加密 `HttpOnly` cookie session。
- `POST /api/hdx/v1/auth/refresh`：校验 CSRF，使用 session 内 refresh token 调用认证中心 `/api/auth/refresh`，轮换并更新 cookie session。
- `POST /api/hdx/v1/auth/logout`：校验 CSRF，调用认证中心 `/api/auth/logout`，并清理 Web cookie session。

状态变更请求必须带 `X-HDX-CSRF` header，值来自 `session` 接口返回的 `csrfToken` 或同名非 `HttpOnly` CSRF cookie。

Web 不提供访客模式。远程服务模式下，未登录访问页面会跳转 `/login`，登录成功后回到原地址；业务 BFF 请求会从 Web session 注入 Bearer access token。all-in-one 模式通过 `NUXT_BACKEND_LOCAL_TOKEN_HEADER` 与 `NUXT_BACKEND_LOCAL_TOKEN` 判断，永远视为已登录，public session 固定为 `LOCAL_ADMIN:local-admin`、显示名 `用户`、角色 `ADMIN`、权限 `*`，业务 BFF 请求只使用本机令牌。

登录页位于 `app/pages/login.vue`，背景图资产位于 `app/assets/images/login-background.bmp`。背景图来自用户指定本机文件，已复制入项目，页面不依赖外部绝对路径。

加密 cookie session 使用以下私有运行时配置：

- `NUXT_AUTH_SESSION_COOKIE_NAME`：可选覆盖项，默认 `hdx_web_session`。
- `NUXT_AUTH_BASE_URL`：可选覆盖项，认证中心基础地址；未设置时读取 `HDX_AUTH_BASE_URL`，默认 `http://localhost:18082`。
- `NUXT_AUTH_SESSION_SECRET`：加密/签名 session 的稳定密钥，至少 32 字符；真实环境必须通过部署 Secret 注入。
- `NUXT_AUTH_CSRF_COOKIE_NAME`：可选覆盖项，默认 `hdx_csrf`。
- `NUXT_AUTH_CSRF_HEADER_NAME`：可选覆盖项，默认 `X-HDX-CSRF`。
- `NUXT_AUTH_COOKIE_SECURE`：可选覆盖项，默认在生产环境为 `true`，其他环境为 `false`。
- `NUXT_AUTH_SESSION_MAX_AGE_SECONDS`：可选覆盖项，默认 `604800`，即 7 天。
- `NUXT_AUTH_REFRESH_SKEW_SECONDS`：可选覆盖项，access token 距离过期多少秒内由 BFF 提前 refresh，默认 `60`。

只要 `NUXT_AUTH_SESSION_SECRET` 不变，Nuxt 进程重启后可以从加密 cookie 恢复 Web 登录态。后端 refresh token 仍是 7 天滑动窗口的事实源；超过 7 天没有触发 refresh 时，用户需要重新登录。

## 设计规则

UI/UX 工作必须使用本目录下的 `ui-ux-pro-max` 技能：

```powershell
& '<python.exe>' .codex/skills/ui-ux-pro-max/scripts/search.py "HDX toolbox workbench SaaS dashboard professional productive" --design-system --persist -p "HDX Web" --page "workbench" -f markdown
```

当前设计系统已生成到 `design-system/hdx-web/`。构建具体页面时，先读 `design-system/hdx-web/pages/<page>.md`，没有页面规则时再读 `design-system/hdx-web/MASTER.md`。

Nuxt UI 使用规则：

- 优先使用 `UButton`、`UForm`、`UFormField`、`UAlert`、`USkeleton`、`UColorModeSelect` 等组件。
- 图标优先使用 `lucide:*`。
- 使用语义色、组件 `variant` 和 `size`，避免在组件里重复硬编码样式。
- 表单使用 Zod schema 绑定校验。

## 验证命令

在 `apps/web/` 下执行：

```powershell
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

如果本机后端未启动，首屏应显示 Web 工作台骨架和后端不可用提示；这不应阻塞 Web build。
