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
- 后端默认地址：`NUXT_BACKEND_BASE_URL`，默认值为 `http://localhost:18080`。
- 本机 all-in-one 令牌可通过 `NUXT_BACKEND_LOCAL_TOKEN_HEADER` 与 `NUXT_BACKEND_LOCAL_TOKEN` 注入，只能留在 Nuxt server 私有 `runtimeConfig` 中。

浏览器不得直接访问后端地址，也不得读取本机令牌。浏览器只调用 Web 自身的 `/api/hdx/v1/**`。

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
