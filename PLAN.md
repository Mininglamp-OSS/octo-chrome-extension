# octo-ext 重写方案

> **目标**：参考 `dmwork-web-mirror/apps/extension` 的产品形态，用最新技术栈在 `octo-ext` 独立仓库里重写插件，**与 web 仓库（octo-web/dmwork-web）零运行时依赖**。

---

## 0. 已对齐的关键决策

| 决策 | 结论 |
|---|---|
| 共享代码策略 | **完全独立，手抄重写** Service/Const/Model 关键逻辑 |
| UI 库 | **Tailwind v4 + shadcn/ui**（替换 Semi UI） |
| 核心组件 | **对照行为重写**，不复制源代码 |
| 节奏 | **MVP 优先**：先跑通 sidepanel 登录 + 会话列表 + 收发消息 |

---

## 1. 技术栈定版（2026 社区主流）

| 层 | 选型 | 备注 |
|---|---|---|
| 扩展框架 | **WXT 0.20** + MV3 | 现状沿用，社区共识 |
| 视图 | **React 19** + ReactDOM 19 | 现状沿用 |
| 语言 | **TypeScript 5.9**（`strict` + `verbatimModuleSyntax` + `noUncheckedIndexedAccess`） | 严格模式 |
| 样式 | **Tailwind v4 CSS-first**（`@theme` 在 CSS 写，不要 JS config） | v4 推荐方式 |
| 组件库 | **shadcn/ui**（按需 copy）| 源码进 `src/components/ui` |
| 图标 | **lucide-react** | mirror 已用 |
| 富文本 | **TipTap 3.x**（core/react/starter-kit/mention/placeholder） | OctoComposer 必需 |
| IM SDK | **wukongimjssdk 1.3.5** | 沿用（后端不变） |
| HTTP | **ky**（fetch 封装） | 替换 axios，bundle 小 3 倍、原生 fetch、内置重试/hooks |
| 后端校验 | **Zod 4** | 关键响应做 schema 校验，后端字段改动不至于 silent failure |
| 异步状态 | **TanStack Query v5** | 替换 mirror 手写 fetch + WKApp endpoint |
| 全局状态 | **Zustand 5** + `persist` middleware | 替换 WKApp ProviderListener；持久化对接 `wxt/storage` |
| 事件总线 | **mitt** | 仅用于 non-React 层（content script ↔ injected） |
| 扩展存储 | **`wxt/storage`** | 替代 `chrome.storage` 直调，类型安全 + reactive |
| 扩展消息 | **`@webext-core/messaging`** | type-safe sendMessage，比手写 protocol 健壮 |
| 虚拟列表 | **`@tanstack/react-virtual`** | 消息流必需 |
| 浮层定位 | **`@floating-ui/react`** | mention/popover/lightbox |
| 工具集 | **`clsx` + `tailwind-merge`**、**`nanoid`**、**`date-fns`** | shadcn 标配 |
| 动画 | **`motion`**（原 framer-motion）按需 | 仅微交互 |
| 测试 | **Vitest 4** + `@vitest/browser-playwright` + jsdom | 沿用 |
| 校验 | **Biome 2.x**（lint + format） | 替换 ESLint/Prettier |
| 包管理 | **pnpm 10** | 单仓单包，不开 workspace |
| Node | ≥ 20 | |

**不引入**：Semi UI、axios、react-router、ahooks、redux、mobx、@dmwork/* 任何包。

---

## 2. 目标目录结构

```
octo-ext/
├── PLAN.md                        # 本文档
├── package.json
├── wxt.config.ts                  # MV3 manifest + side_panel + content scripts
├── tailwind.config.ts
├── biome.json
├── tsconfig.json
├── vitest.config.ts
├── public/                        # 静态资源（emoji、lottie 占位等）
├── entrypoints/                   # 仅做编排，业务在 src/
│   ├── background.ts              # 消息路由 + offscreen + badge + contextMenus
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx               # 挂载 <SidepanelApp/>
│   │   └── style.css
│   ├── cmdk/                      # 全局浮窗（独立 popup）
│   │   ├── index.html
│   │   └── main.tsx
│   ├── cmdk-overlay.content/      # 注入到任何网页的 cmdk overlay
│   │   ├── index.tsx
│   │   └── overlay.css
│   ├── offscreen/                 # 长连接/通知容器
│   │   ├── index.html
│   │   └── main.ts
│   ├── options/
│   │   ├── index.html
│   │   └── main.tsx
│   ├── qq-doc.content.ts          # 腾讯文档桥
│   ├── injected-qq-doc.ts         # main world 注入
│   └── injected-plugin-call.ts    # window.pluginCall API
├── src/
│   ├── app/                       # 顶层 App（各入口共用 Provider/Theme）
│   │   ├── SidepanelApp.tsx
│   │   ├── CmdkApp.tsx
│   │   ├── OptionsApp.tsx
│   │   └── providers.tsx          # QueryClient + Theme + Toast + Modal portal
│   ├── api/
│   │   ├── client.ts              # ky 实例 + hooks（认证/错误/space header 注入）
│   │   ├── endpoints.ts           # 接口 URL 常量
│   │   ├── schemas/               # Zod schema（每个接口响应一个）
│   │   └── queries/               # TanStack Query hooks（按域分文件）
│   │       ├── auth.ts
│   │       ├── conversations.ts
│   │       ├── channels.ts
│   │       ├── categories.ts
│   │       ├── pinned.ts
│   │       ├── spaces.ts
│   │       └── threads.ts
│   ├── const/
│   │   ├── channel.ts             # ChannelType / Subscriber / GroupRole
│   │   ├── message.ts             # MessageContentTypeConst / MessageReasonCode
│   │   └── endpoint.ts            # mittBus event names
│   ├── im/
│   │   ├── client.ts              # 封装 WKSDK 单例（连接/重连/订阅）
│   │   ├── conversation.ts        # 会话语义 + ConversationWrap 等价物
│   │   ├── message.ts             # 收发 + ack + reaction
│   │   ├── typing.ts              # TypingManager
│   │   └── hooks/                 # useChannel/useConversations/useMessages
│   ├── messages/                  # 消息内容类型 + 渲染
│   │   ├── types.ts               # ContentType union
│   │   ├── File.ts
│   │   ├── Image.ts
│   │   ├── LottieSticker.ts
│   │   ├── Text.ts
│   │   └── render/                # 每种 content 的 React 渲染组件
│   ├── stores/                    # Zustand
│   │   ├── auth.ts                # token / 当前用户
│   │   ├── space.ts               # 当前 space_id
│   │   ├── ui.ts                  # drawer/toast/modal
│   │   └── preferences.ts         # 与 chrome.storage 联动
│   ├── modules/                   # 业务模块（注册副作用，替代 BaseModule）
│   │   ├── auth/                  # 登录流（替代 LoginModule）
│   │   ├── contacts/              # 通讯录（替代 ContactsModule）
│   │   ├── datasource/            # 资料源（替代 DataSourceModule）
│   │   └── index.ts               # 各模块 init()
│   ├── components/
│   │   ├── ui/                    # shadcn 拷贝出来的 button/input/dialog/...
│   │   ├── octo/                  # 业务组件（重写版）
│   │   │   ├── OctoShell.tsx
│   │   │   ├── OctoSidepanelLayout.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   ├── Conversation.tsx
│   │   │   ├── ChannelPicker.tsx
│   │   │   ├── ChannelHeader.tsx
│   │   │   ├── ChatToolbar.tsx
│   │   │   ├── ContextMenus.tsx
│   │   │   ├── CreateCategoryModal.tsx
│   │   │   ├── EmojiToolbar.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Lightbox.tsx
│   │   │   ├── SearchPopover.tsx
│   │   │   ├── SettingsPopover.tsx
│   │   │   ├── SlashCommandMenu.tsx
│   │   │   ├── SpaceSwitcherPopover.tsx
│   │   │   └── Toast.tsx
│   │   └── composer/              # OctoComposer 拆分（TipTap）
│   │       ├── Composer.tsx
│   │       ├── MentionSuggestion.tsx
│   │       ├── VoiceButton.tsx
│   │       ├── VoiceIndicator.tsx
│   │       ├── useVoiceInput.ts
│   │       ├── applyVoiceTranscription.ts
│   │       └── voiceMentionParser.ts
│   ├── platform/                  # extension API 抽象（薄到几乎只有类型）
│   │   ├── storage.ts             # 基于 wxt/storage，定义 key + schema
│   │   ├── messaging.ts           # 基于 @webext-core/messaging 定义 protocol
│   │   ├── notifications.ts
│   │   ├── contextMenus.ts
│   │   ├── sidePanel.ts
│   │   ├── offscreen.ts
│   │   └── scripting.ts
│   ├── background/                # background.ts 拆分
│   │   ├── badge.ts               # 呼吸动画 + 角标
│   │   ├── notifications.ts
│   │   ├── menus.ts               # contextMenus 注册
│   │   ├── auth-sync.ts           # offscreen ↔ background ↔ sidepanel
│   │   ├── cocraft.ts             # 协作画布桥
│   │   ├── handlers.ts            # 按 message.type 路由
│   │   └── index.ts               # 装配
│   ├── utils/
│   │   ├── avatar.ts              # avatarGradient / getFirstChar
│   │   ├── titleColor.ts
│   │   ├── time.ts
│   │   ├── extractErrorMsg.ts
│   │   └── ...
│   ├── hooks/
│   ├── styles/
│   │   ├── tokens.css             # CSS 变量（颜色/间距/阴影）
│   │   └── globals.css            # Tailwind layer + base
│   └── types/
│       ├── ext.d.ts               # extension 全局
│       └── qq-doc.d.ts
└── tests/                         # vitest（每个组件就近放 *.test.tsx 也可）
```

---

## 3. 数据/协议层移植清单（P1 重点）

照抄 `dmwork-web-mirror/packages/dmworkbase/src/Service/*` 的**行为**，文件结构按上面 `src/api/` `src/const/` `src/im/` 重排。**逐文件对照**：

| mirror 源（packages/dmworkbase/src） | 行数 | octo-ext 目标 | 处理 |
|---|---|---|---|
| `Service/APIClient.ts` | 160 | `src/api/client.ts` | 拦截器/`extractErrorMsg`/`spaceIdCallback` 全抄；`tokenCallback` 改成读 `useAuthStore.getState().token` |
| `Service/Const.ts` | 131 | `src/const/{channel,message,endpoint}.ts` | 拆成多文件；class 改 enum/const object |
| `Service/Model.tsx` | 673 | `src/im/conversation.ts` + `src/messages/types.ts` | 重头戏。`ConversationWrap` 拆成 Zustand selector + 纯函数；不再继承 React.Component |
| `Service/Thread.ts` | 67 | `src/im/thread.ts` | 直接抄 `parseThreadChannelId` 等纯函数 |
| `Service/CategoryService.ts` | (小) | `src/api/queries/categories.ts` + Zustand store | 用 TanStack Query 包装 |
| `Service/PinnedService.ts` | 41 | `src/api/queries/pinned.ts` | 同上 |
| `Service/ChannelSetting.ts` | (小) | `src/api/queries/channels.ts` | 同上 |
| `Service/SpaceService.tsx` | 255 | `src/stores/space.ts` + `src/api/queries/spaces.ts` | 拆成 store + queries |
| `Service/StorageService.tsx` | 32 | `src/platform/storage.ts` | 换成 `chrome.storage.local` |
| `Service/Convert.ts` | 399 | `src/messages/convert.ts` | 类型转换，纯函数，直接抄 |
| `Service/TypingManager.tsx` | 114 | `src/im/typing.ts` | 抄逻辑，去掉 React.Component 包装 |
| `Service/EmojiService.ts` | 247 | `src/services/emoji.ts` | 抄 |
| `Service/VoiceService.ts` | 139 | `src/services/voice.ts` | 抄 |
| `Service/Provider.tsx` | 75 | **不抄** | WKApp 的 ProviderListener 注册中心被 Zustand + TanStack Query 替代 |
| `Service/Route.tsx` | 74 | **不抄** | web 路由，插件不需要 |
| `Service/Module.ts` | 108 | `src/modules/index.ts` | 极简化，每个 module 暴露 `init()` |
| `App.tsx`（WKApp 928 行） | 928 | 拆解 | 见 §4 |
| `Messages/*` | (多) | `src/messages/*` | 每种消息类型 1 个文件，含 type + render；不抄基类继承 |

**重写时坚持**：
- 不引入 `React.Component`，全部 hooks + 函数组件
- 不写 mixin / Provider 注册中心，副作用挂 Zustand `subscribe` 或 `useEffect`
- API 请求一律走 TanStack Query；副作用走 `useMutation`
- 类型严格：枚举用 `as const` + union 而非 class static

---

## 4. WKApp 的拆解（最大风险点）

mirror 的 `App.tsx` 928 行做了**5 件事**，重写时分别落到下面：

| WKApp 职责 | 重写归宿 |
|---|---|
| ① ProviderListener 注册（菜单/路由/弹窗 endpoint） | mitt 事件总线（`src/const/endpoint.ts` 集中事件名）+ Zustand stores |
| ② mittBus 全局事件 | 直接保留 `mitt`，但收敛事件类型到 `src/const/endpoint.ts` |
| ③ 配置/主题/语言/space | `useUIStore` + `useSpaceStore` + `useAuthStore` |
| ④ 当前用户/登录状态 | `useAuthStore` + TanStack Query `useMe()` |
| ⑤ DOM 引用（4 处） | 各自的组件 ref，不再全局持有 |

**取舍**：mirror 里 `WKApp.shared` 全局单例的 API（`WKApp.endpoints.register(...)`）我们用一个轻封装保留兼容名（`octo.endpoints.register(...)`），方便后续从 mirror 抄业务模块时少改 import；底层换成 mitt + map。

---

## 5. background.ts 的拆解（615 行 → 多文件）

`entrypoints/background.ts` 现状是单文件 615 行，重写后**入口只做装配**：

```ts
// entrypoints/background.ts（重写后约 30 行）
import { defineBackground } from "wxt/sandbox";
import { setupBadge } from "@/background/badge";
import { setupNotifications } from "@/background/notifications";
import { setupMenus } from "@/background/menus";
import { setupAuthSync } from "@/background/auth-sync";
import { setupCocraftBridge } from "@/background/cocraft";
import { setupMessageHandlers } from "@/background/handlers";

export default defineBackground(() => {
  setupBadge();
  setupNotifications();
  setupMenus();
  setupAuthSync();
  setupCocraftBridge();
  setupMessageHandlers();
});
```

每个 `setup*` 在 `src/background/*.ts` 内独立可测。

---

## 6. 分期实施计划

### P0 — 基建（≈ 0.5 天）

- [ ] `pnpm add` 依赖：tailwindcss@next、@tailwindcss/vite、axios、zustand、@tanstack/react-query、mitt、wukongimjssdk、@tiptap/{core,react,starter-kit,extension-mention,extension-placeholder,pm}、lucide-react、clsx、tailwind-merge
- [ ] devDeps：@biomejs/biome、vitest@4、@vitest/browser-playwright、jsdom、@types/chrome、vite-tsconfig-paths
- [ ] `tailwind.config.ts` + `src/styles/globals.css`（含 `@layer base/components/utilities`）
- [ ] `biome.json` + 接管 lint/format（删 Prettier/ESLint 残留）
- [ ] `tsconfig.json` 加路径别名 `@/*`、`strict`、`verbatimModuleSyntax`
- [ ] `wxt.config.ts` 改成 mirror 的 manifest（sidepanel/options/permissions/host_permissions/web_accessible_resources）
- [ ] 初始化 shadcn：`npx shadcn@latest init`，加 Button/Input/Dialog/Popover/Toast/Tooltip/Separator/ScrollArea

### P1 — 数据/协议层（≈ 2 天）

- [ ] `src/api/client.ts`：axios 实例 + 拦截器（对照 `APIClient.ts`）
- [ ] `src/const/*`：从 `Const.ts` 拆 enum/const
- [ ] `src/stores/{auth,space,ui,preferences}.ts`
- [ ] `src/platform/{storage,runtime,notifications,contextMenus,sidePanel,offscreen}.ts`
- [ ] `src/im/client.ts`：WKSDK 封装（connect/disconnect/auto-reconnect/onMessage）
- [ ] `src/im/{conversation,message,typing,thread}.ts`
- [ ] `src/api/queries/*`：先实现 auth / conversations / channels（够 MVP）
- [ ] `src/messages/types.ts` + Text/Image/File/LottieSticker
- [ ] `src/utils/{avatar,titleColor,extractErrorMsg,time}.ts`
- [ ] `src/app/providers.tsx`：QueryClient + Theme + Toaster

### P2 — sidepanel MVP（≈ 3 天）

- [ ] `entrypoints/sidepanel/main.tsx` 挂 `<SidepanelApp/>`
- [ ] 登录流：`src/modules/auth/LoginPage.tsx` + `useLogin()` mutation
- [ ] `OctoShell.tsx`：顶部 SpaceSwitcher + 侧栏 ConversationList + 主区 Conversation
- [ ] `ConversationList.tsx`：基于 `useConversations()` + Zustand store
- [ ] `Conversation.tsx`：消息流（虚拟列表用 `@tanstack/react-virtual`）+ Composer
- [ ] `Composer.tsx`（TipTap）：纯文本 + emoji + 文件上传，**不做** voice/mention（推到 P4）
- [ ] `ChannelHeader.tsx` / `Toast.tsx` / `ErrorBoundary.tsx`
- [ ] 跑通：登录 → 选会话 → 收消息 → 发文本/图片

**验收标准**：sidepanel 打开后能登录、看到会话列表、点开任一会话能看到历史消息、发文本和图片对端能收到、断网重连后能继续。

### P3 — 多入口 + background 拆解（≈ 2 天）

- [ ] `src/background/*` 8 个文件，对照 mirror 615 行逐功能搬运
- [ ] `entrypoints/offscreen/`：搬 mirror 的长连接 host
- [ ] `entrypoints/options/`：基本设置页（通知开关、语言、host 配置）
- [ ] `entrypoints/cmdk/` + `entrypoints/cmdk-overlay.content/`：cmdk 命令面板（先 MVP，复杂选择交互延后）
- [ ] `entrypoints/qq-doc.content.ts` + `entrypoints/injected-qq-doc.ts` + `entrypoints/injected-plugin-call.ts`

### P4 — 高级特性（≈ 2 天）

- [ ] Composer voice 输入：`useVoiceInput` + `VoiceIndicator` + `applyVoiceTranscription`
- [ ] Mention：`MentionSuggestion` + `voiceMentionParser`
- [ ] 附件上传完善（拖拽/粘贴/进度）
- [ ] `Lightbox.tsx` / `SearchPopover.tsx` / `SettingsPopover.tsx` / `SpaceSwitcherPopover.tsx`
- [ ] `SlashCommandMenu.tsx` / `EmojiToolbar.tsx` / `ContextMenus.tsx`
- [ ] `Thread`（子区）面板

---

## 7. 测试策略

- **单元测试**（Vitest + jsdom）：`src/utils/*`、`src/messages/convert.ts`、`src/const/*` 的纯函数 100%
- **组件测试**（@vitest/browser-playwright）：Composer 输入流、ConversationList 滚动、ChannelPicker 选择
- **mirror 已有测试**对照：`OctoComposer.voice.test.tsx`、`CmdKApp.members.test.ts`、`buildCmdkMessageText.test.ts` — 写新组件时把这些用例移植过来当 fixture，能保证行为对齐

---

## 8. 风险与延迟决策

| 风险 | 缓解 |
|---|---|
| WKSDK API 与 React 19 不完全兼容（事件回调里的 setState 时序） | P1 写 thin wrapper 时用 `flushSync` / `useSyncExternalStore` 接入 |
| Semi UI Drawer/Popover 视觉迁移到 shadcn 需要逐项调样式 | P2 先用 shadcn 默认主题，视觉对齐放 P4 |
| TipTap 3 mention 在 sidepanel 窄宽度下定位 | P4 用 `floating-ui` 微调 |
| 上游 dmwork 后端协议改动 | 通过 `src/api/client.ts` 的拦截器集中处理，新增字段不破坏 |
| chrome.storage 容量上限（5MB local / 100KB sync） | `useAuthStore` 持久化用 `chrome.storage.local`；偏好用 `sync`；消息历史不持久化 |

**延后到实施中再决定**：
- 路由库要不要引（目前判断 sidepanel/cmdk 都不需要）
- 是否引入 i18n（mirror 似乎硬编码中文，P4 再看）
- 是否切 oxlint 替代 Biome lint（Biome 已经够快）

---

## 9. 不做的事 / web 端不抄清单

**架构上不抄**（这些是 web 那边为可插拔架构 + 路由 + Layout 设计的，插件用不到）：
- ❌ `Service/Route.tsx` — web 路由
- ❌ `Service/Provider.tsx` — Provider 注册中心
- ❌ `Service/Section.tsx` — web layout sections
- ❌ `Service/Module.ts`（108 行 BaseModule 基类）— 改为 `src/modules/*/init.ts` 平铺函数
- ❌ `WKApp.endpoints.register(...)` / `WKApp.shared` 全局单例 API（**不留任何兼容名**）— 用 Zustand subscribe 替代
- ❌ `WKApp` 里 ProviderListener / Section / FrameContent 等 web shell 概念
- ❌ `Service/Model.tsx`（673 行）里 `React.Component` 写法 — 只挑出纯函数和类型，行为重写

**消息层只抄实际渲染的**（节省 ~60% 代码）：
- ✅ Text / Image / File / FileContent / LottieSticker / Thread / Voice / Mergeforward
- ❌ RTC 音视频通话全家桶（rtcResult/rtcSwitchTo*/rtcCancel/rtcMissed/...）
- ❌ Screenshot / Card / Location / Flame / Gif / Video / JoinOrganization / ApproveGroupMember / SignalMessage / SummaryCard / System / Time / Typing / Revoke / HistorySplit / Unsupport
- 后续如确实用到再按需补；不预先抄

**Service 层只抄活路径**：
- ✅ APIClient / Const / Thread / CategoryService / PinnedService / ChannelSetting / SpaceService / Convert（按需挑函数）/ EmojiService / VoiceService / TypingManager
- ❌ ProhibitwordsService（**确认插件实际用不用**，不用就不抄）
- ❌ MessageManager.tsx 的 React 包装层 — 用 hooks 重写
- ❌ StorageService.tsx 的 localStorage 实现 — 直接用 `wxt/storage`

**写法上不做的**：
- ❌ `React.Component` / class component 全部不写
- ❌ Provider 嵌套地狱 — Zustand store 直接 import 用
- ❌ 全局可变单例（除底层 WKSDK 连接实例）
- ❌ 自写 chrome.storage / browser.runtime 封装 — 用 `wxt/storage` + `@webext-core/messaging`
- ❌ 自写 fetch 拦截器 — 用 ky 的 hooks
- ❌ 自写虚拟列表 — 用 `@tanstack/react-virtual`
- ❌ pnpm workspace（保持单仓单包）
- ❌ 复制 mirror 任何 `.tsx`/`.ts` 源文件（只参考行为，重写时打开 mirror 做"行为对照"）
- ❌ 重写期间加新产品需求（先一比一对齐 mirror，再迭代）

---

## 10. 推进流程

**每期开始前先和你确认范围，确认后我闷头干完一期再汇报。**

下一步：等你给 **P0 基建** 开绿灯（见下方"P0 详单"），我开始装依赖 + 配 Tailwind/Biome/WXT manifest + 初始化 shadcn。

### P0 详单（等你确认）

**会装的依赖（生产）**：
```
react react-dom
wxt @wxt-dev/module-react @wxt-dev/auto-icons
tailwindcss @tailwindcss/vite
ky zod
@tanstack/react-query @tanstack/react-virtual
zustand mitt
wukongimjssdk
@tiptap/core @tiptap/react @tiptap/starter-kit
@tiptap/extension-mention @tiptap/extension-placeholder @tiptap/pm
lucide-react clsx tailwind-merge nanoid date-fns
@floating-ui/react motion
@webext-core/messaging
```

**会装的依赖（开发）**：
```
typescript @types/react @types/react-dom @types/chrome
@biomejs/biome
vitest @vitest/browser-playwright jsdom
vite-tsconfig-paths
```

**会创建/改的文件**：
1. `package.json` — 改名 `octo-ext`，加 scripts（dev/build/zip/test/lint/format/typecheck）
2. `wxt.config.ts` — 加 manifest（side_panel / options_ui / permissions / host_permissions / web_accessible_resources），按 mirror 那套全要
3. `tsconfig.json` — strict + 路径别名 `@/* → src/*`
4. `biome.json` — lint + format 配置
5. `src/styles/globals.css` — Tailwind v4 + `@theme` 设计 token
6. `src/components/ui/` — shadcn 初始化 + Button/Input/Dialog/Popover/Toast/Tooltip/Separator/ScrollArea/Sheet/Tabs/DropdownMenu/Avatar
7. `src/app/providers.tsx` — QueryClient + Theme provider 骨架
8. `entrypoints/sidepanel/main.tsx` — 改成挂 `<SidepanelApp/>` 但内容只放 "Hello, octo-ext" 占位
9. `entrypoints/background.ts` — 改成 `defineBackground(() => { /* TODO */ })` 占位
10. `entrypoints/{cmdk,cmdk-overlay.content,offscreen,options}` 目录骨架（空 html + main 文件）
11. 删除 `entrypoints/popup/` 和 `entrypoints/content.ts`（mirror 没用 popup，用 sidepanel）
12. `.gitignore` 补 `.wxt/`、`web-ext-artifacts/`、`.turbo/`

**P0 验收**：`pnpm dev` 能起 sidepanel，`pnpm build` 出 dist，`pnpm test` 跑通空测试，`pnpm typecheck` 0 错误。**不写业务逻辑**。

---

## 11. 待你拍板的小细节（可在 P0 一并确认）

| 项 | 默认 | 备选 |
|---|---|---|
| 路径别名 | `@/* → src/*` | `~/* → src/*` |
| 包名 | `octo-ext` | 其他 |
| 默认主题 | shadcn `new-york` 风格 + neutral 色板 | `default` / 其他色板 |
| 暗色模式 | `next-themes` 风格自实现（`html.dark` class）+ 跟系统 | 仅亮色 / 仅暗色 |
| 初始 manifest 权限 | mirror 那套（`notifications/storage/offscreen/sidePanel/contextMenus/scripting` + `<all_urls>` host） | 收紧（只 storage + sidePanel） |
| Git commit 规范 | conventional commits（`feat:` / `fix:` / `chore:`） | 你团队习惯 |
| CI | 暂不配 | GitHub Actions 跑 typecheck + test + build |

没意见就按"默认"列推进。

---

## 12. 实施进度（**新会话从这里接**）

### 已完成 ✅

| 阶段 | 内容 | 验证 |
|---|---|---|
| **P0** | 基建（WXT/React19/TS strict/Tailwind v4/Biome 2/Vitest 4/shadcn 12 primitives/srcDir=src） | ✅ |
| **P1** | 数据/协议层（ky/Zod/Zustand/TanStack Query/wxt-storage/@webext-core-messaging/WKSDK 封装/4 类 message 类型/6 域 schema+queries/IM hooks） | ✅ |
| **P2** | sidepanel MVP（登录页/Shell stack 导航/ConversationList/Conversation/MessageList 虚拟列表/Composer TipTap+emoji+图片+文件+拖拽+粘贴/COS 直传） | ✅ |
| **P3** | offscreen 重构 + 多入口（IM 搬到 offscreen+RPC/sidepanel proxy/background 完整化 badge+notif+menus+auth-sync/cmdk popup MVP/cmdk-overlay 划词浮标/window.pluginCall/QQ 文档桥） | ✅ |
| **P4** | 进阶（history 分页/Options 页/Lightbox/Reply 引用/消息右键菜单+撤回/SearchPopover 本地/Mention @） | ✅ |
| **P5** | voice 消息（录音+转写+发送+播放）/Thread 子区 Sheet/@我未读 indicator | ✅ |
| **P6** | InfoDrawer/ContactsDrawer/全局 SearchPopover/ConversationList 置顶分组+右键菜单/已读回执/消息反应/SlashCommandMenu | ✅ |
| **P7-1** | Vertical Rail（左侧竖向 pinned 图标导航） | ✅ |
| **P7-2** | Composer 完善（MAX_MESSAGE_LENGTH=2000+counter/invisibleChars 过滤/per-channel 草稿持久化 wxt-storage/附件上限 MAX_ATTACHMENTS=20+MAX_TOTAL_SIZE=100MB+BLOCKED_EXTENSIONS） | ✅ |
| **P7-3a** | Categories 数据 + 弹层（CreateCategoryModal / CategoriesManageModal / MoveToCategoryDialog / useMoveGroupToCategory / useSortCategories / categoriesUi store） | ✅ 文件已创建，未集成 |
| **P7-3b** | Categories UI 集成：SpaceSwitcher 底部「管理分组…」入口；ConversationList 群项右键「移动到分组…」；按类目分段渲染（私聊段 + 每个 category 段 + 未分组段，可折叠） | ✅ |
| **P7-4** | Reminders 提醒系统：reminder schema/endpoints；offscreen 注册 `syncRemindersCallback`/`reminderDoneCallback`；attach 监听器在 connect/新消息后自动 `reminderManager.sync()`；ConversationView 加 mentionCount；imSyncReminders/imReminderDone RPC；UI ConversationList/VerticalRail 显示 mentionCount（与 atMeStore 取 max）；进入 channel 自动 `imReminderDone` | ✅ |

### 待做（按优先级）

| 阶段 | 详细 |
|---|---|
| **P7-5** | **Cmdk 高级**：多附件拖拽+预览（复用 P7-2 的 validateAttachments）；超长选区（>500 char）自动 `buildSelectionMarkdownFile` 转 .md 附件；SEND_ACK_TIMEOUT=12s 异步反馈 + 失败 toast；`buildCmdkMessageText` 拼接 mention/reply |
| **P7-6** | **Layout cli/message**：preferences 加 `layout: 'cli' \| 'message'`；`html.dataset.layout` 同步；cli 模式更紧凑（小字号/小间距）；OctoSettingsPopover（sidepanel 顶部下拉同时切 theme+layout，不再跳 options 页） |
| **P7-7** | **Logout 双击保护**：UserMenu 退出第一次进 armed 态（红色提示），5s 内再点才真退；**撤回占位**：撤回后渲染"xxx 撤回了一条消息"灰条（需要 IM 流监听 revoke 消息并在 useChannelMessages 替换原消息） |
| **P7-8** | 验收：typecheck/lint/test/build/真机 |

### 当前编译状态

- `pnpm typecheck` ✅ 0 错
- `pnpm test` ✅ 31 用例全过
- `pnpm build` ✅ 2.15 MB
- `pnpm lint` ✅ 0 错（10 warning + 3 info 都是 warn/info 级，正常）

### 新会话快速对接

1. 读 `PLAN.md` 第 12 节即知整体状态
2. 当前所在分支：`main`，未提交（pnpm test/build/typecheck/lint 都 OK）
3. 接下来：从 **P7-5 Cmdk 高级** 开始；继续顺序做 P7-6 → P7-7 → P7-8
4. 重要约定：
   - 不抄 mirror 源码，对照行为重写
   - 完全独立，零 web 仓库依赖
   - 不引 cocraft（用户明示）
   - ✅ 已支持 mergeforward（接收侧渲染，contentType=11，2026-05 补）
   - 每改完一块跑 `pnpm typecheck && pnpm lint && pnpm test`
5. 已知 quirks：
   - WXT `@` 别名自动指 `srcDir` —— 别覆盖
   - 多次 Write 同一文件可能被某 IDE auto-fmt 反复改导入顺序，必要时整文件 Write 兜底
   - biome `noStaticElementInteractions` 误报 → 加 biome-ignore 注释
   - WXT content script 子构建对 CSS alias 解析有 bug → CSS import 用相对路径

### 已建的关键约定文件路径

```
src/
  api/queries/         # 8 个 query 文件 (auth/conversations/channels/categories/pinned/spaces/messages/members/reactions/search/contacts/voice/channelActions/categoryActions)
  api/schemas/         # 7 个 Zod schema 文件
  api/endpoints.ts     # 30+ endpoint 常量
  api/client.ts        # ky + 401 自动登出
  im/
    client.ts          # offscreen-side WKSDK 单例 + 注册 5 类 content
    proxy.ts           # client-side messaging RPC 门面
    serialize.ts       # SerializedContent ↔ WKSDK class
    upload.ts          # COS 直传 (sidepanel/cmdk 客户端)
    uploadTask.ts      # offscreen-side noop task
    send.ts            # sendText/sendImage/sendFile/sendVoice
    history.ts         # syncMessages (offscreen-side)
    message.ts         # MessageView + reactions
    conversation.ts    # ConversationView + sort + at-me filter
    thread.ts          # parse/buildThreadChannelId
    typing.ts
    hooks/             # useChannelMessages/useImConnectionStatus/useConversationViews/useAtMeWatcher/useReadMarker
  platform/
    messaging.ts       # OctoProtocolMap（含 imSendMessage/imFetchHistory/imSyncConversations/imGetStatus + 广播 imMessageReceived/imStatusChanged/imConversationsUpdated + cross-context auth + cmdk + qq-doc）
    storage.ts         # wxt-storage defineItem (auth/pending/preferences/theme)
    contextMenus / notifications / offscreen / scripting / sidePanel
  stores/              # auth/space/ui/preferences/currentChannel/replyDraft/atMe/thread/drawer/categoriesUi
  messages/            # text/image/file/voice/lottieSticker + types union
  const/               # channel/message/endpoint
  components/
    composer/          # EmojiPicker/mention/slash/composerLimits + voice/{useVoiceRecorder,VoiceButton}
    octo/              # 18 个组件 (LoginPage/OctoShell/VerticalRail/SpaceSwitcher/UserMenu/ConversationList/Conversation/MessageList/MessageBubble/MessageAvatar/MessageContent/MessageReactions/Composer/Lightbox/SearchPopover/ThreadSheet/OctoInfoDrawer/OctoContactsDrawer/CreateCategoryModal/CategoriesManageModal/MoveToCategoryDialog)
    ui/                # 12 shadcn primitives
  app/                 # AppBoot/SidepanelApp/CmdkApp/OptionsApp/providers
  background/          # ensureOffscreen/badge/notifications/menus/handlers/auth-sync/index
  entrypoints/         # background/sidepanel/cmdk/cmdk-overlay.content/options/offscreen/qq-doc.content/injected-*
  hooks/useApplyTheme/useSidepanelBridge
  styles/globals.css
```

