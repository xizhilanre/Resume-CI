# Resume CI — Claude 项目指令

> 从 JD 到一页 PDF 的全链路 AI 求职工作台。Monorepo（pnpm + Turborepo），双端同构（Web Next.js + Desktop Electron）。

## 项目身份

- **定位**：混合项目 — 个人求职工作台 + 开源 AI 应用工程展示
- **上游依赖**：3 个 CLI 项目位于 `../` 相对目录
  - `shushu-internship-tool` — 项目审计/候选人评分/面试准备
  - `shushu-internship-resume-optimizer` — 成就审计/简历排序/文档知识库
  - `vibe-resume` — Node.js HTML→PDF（Playwright + Chromium）
- **远程仓库**：`https://github.com/xizhilanre/Resume-CI.git`

## 实现状态（12/54 Tasks, 22 tests）

```
Phase 1-3 ✅  地基+协议+连通
Phase 4-5 ✅  WizardShell+Zustand+FastAPI骨架+vibe-resume接入
Phase 6-8 ⬚  Web/Desktop壳+CI/CD
Phase 9-11 ⬚  Step①②③④⑤ 真实UI组件
Phase 12-13 ⬚ CLI全链路+生产就绪
```

**已完成：**
- `packages/core` — 零依赖协议包：消息类型、`IResumeCIAdapter` 接口、`MockAdapter`（9 tests）
- `packages/ui` — React 组件库：`WizardState`、`useWizardStore`（Zustand）、`AdapterContext`、`WizardShell`、`WizardProgress`、`SplitPane`、`TypewriterText`（12 tests）
- `services/fastapi` — WebSocket handler + `PipelineService` skeleton + `export_pdf` 接入 vibe-resume（1 test）
- `scripts/vibe-resume` — 从上游复制，已 `npm install`

**尚未创建：**
- `apps/web` — Next.js 壳
- `apps/desktop` — Electron 壳
- `packages/python-bridge` — Electron Python 调用封装
- 所有 5 步真实 UI 组件（Anchor/Blueprint/Alignment/Polish/Export）
- CLIBridge、SQLite、Docker、E2E、LLM prompts

## 技术栈

| 层 | 技术 |
|---|------|
| 包管理 | pnpm 9.15 + Turborepo 2.x |
| 语言 | TypeScript 5.7 (strict) + Python 3.11+ |
| 前端 | React 19 + Zustand 5 + Tailwind CSS 4 + Framer Motion 12 |
| 后端 | FastAPI + uvicorn + WebSocket |
| CLI 集成 | asyncio subprocess |
| 测试 | Vitest (TS) + pytest-asyncio (Python) + Playwright (E2E, 未实现) |
| 部署 | Docker → Fly.io (未实现)、Electron Builder (未实现) |

## Monorepo 结构

```
resume-ci/
├── apps/
│   ├── web/          # Next.js (未创建)
│   └── desktop/      # Electron (未创建)
├── packages/
│   ├── core/         # 零依赖协议层 ✅
│   ├── ui/           # 共享 React 组件 ✅
│   └── python-bridge/# Electron Python 桥 (未创建)
├── services/
│   └── fastapi/      # WebSocket 服务 + PipelineService ✅
├── scripts/
│   └── vibe-resume/  # HTML→PDF CLI ✅
└── docs/
    ├── design/       # 架构设计文档
    └── superpowers/
        ├── plans/    # 13 个 Phase 实现计划
        └── specs/    # 组件级设计文档
```

## 包依赖拓扑

```
@resume-ci/core (零依赖)
  ↑
@resume-ci/ui (依赖 core + react + zustand)
  ↑
apps/web, apps/desktop (注入不同 IResumeCIAdapter 实现)
  ↓
services/fastapi (云端 Python 服务)
```

## 核心架构约束

### IResumeCIAdapter — 控制反转接口

Web/Desktop 两端 100% 复用 UI，仅注入不同 Adapter：
- Web：`RemoteAdapter` → WebSocket → 云端 FastAPI
- Desktop：`LocalAdapter` → IPC → 本地 Python 子进程
- Mock：`MockAdapter` → 假数据（UI 开发 & 测试）

### 消息协议

```typescript
ClientMessage = { type: 'cmd', id, method, params } | { type: 'cancel', id }
ServerMessage = { type: 'ack', id } | { type: 'chunk', id, data, seq }
             | { type: 'done', id, result } | { type: 'err', id, code, message, partial? }
```

规则：
- `done.result` 不为 null（流式方法返回聚合结果）
- `err.partial` 携带半成品
- `chunk.seq` 单调递增（前端可检测丢包）

### 五步状态机

```
anchor → blueprint → alignment → polish → export
```

`WizardState` 通过 Zustand `useWizardStore` 驱动，`goToStep()` 只能回退到已访问步骤。

### Electron 安全沙箱（未实现但已设计）

- Python 子进程必须在 Main Process
- Renderer 只能通过 preload 的 `contextBridge.exposeInMainWorld()` 通信
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`

### Desktop 免安装 Python 运行时（未实现但已设计）

- CI 构建 `python-runtime.zip`（Python embeddable + pip deps + CLI 源码）
- 首次启动解压到 `%LOCALAPPDATA%\ResumeCI\python\`
- 用户端零网络、零 pip

## 编码约定

### TypeScript

- **`@resume-ci/core` 零依赖** — 不得 import 任何第三方包
- 使用原生 `createElement` 而非 JSX（`@resume-ci/ui` 组件）
- `AsyncIterable` 用于流式方法，`Promise` 用于一次性方法
- 测试文件与源文件同目录，后缀 `.test.ts` / `.test.tsx`

### Python

- FastAPI 目录：`services/fastapi/app/`
- 测试：`services/fastapi/tests/`
- `PipelineService` 方法名：`.` 替换为 `_`（如 `jd.parse` → `jd_parse`）
- 异步方法用 `async def` + `await`，测试用 `@pytest.mark.asyncio`

### 命名

- 文件：kebab-case（`use-wizard-store.ts`）
- 目录：kebab-case（`python-bridge/`）
- 接口：`I` 前缀（`IResumeCIAdapter`）
- 组件：PascalCase（`WizardShell`）
- Python：snake_case（`pipeline.py`）

### Git

- Commit 格式：`<type>(<scope>): <message>`（Conventional Commits）
- Co-Authored-By 尾行
- 分支：`master`（主分支）

## 常用命令

```bash
# 安装
pnpm install

# 类型检查
pnpm turbo run typecheck

# 测试
pnpm turbo run test                          # 全部 TS 测试
pnpm turbo run test --filter=@resume-ci/ui   # 仅 ui 包
cd services/fastapi && python -m pytest tests/ -v  # Python 测试

# 开发（需要 apps 创建后才有效）
pnpm dev                                      # 全栈启动
pnpm dev:web                                  # 仅 Next.js
pnpm dev:fastapi                              # 仅 FastAPI（uvicorn --reload）

# 格式化
pnpm format
```

## 设计文档索引

完整计划在 `docs/superpowers/plans/`，共 54 个 Task 分 13 个 Phase：

| Phase | 文件 | Tasks |
|-------|------|-------|
| 1-3 | `phase1-3.md` | 1-6：Monorepo + Core + MockAdapter + UI 骨架 |
| 4-5 | `phase4-5.md` | 7-12：WizardShell + Zustand + FastAPI + vibe-resume |
| 6-8 | `phase6-8.md` | 13-18：Web/Desktop 壳 + CI/CD |
| 9 | `phase9.md` | 19-26：Step①② 真实 UI |
| 10 | `phase10.md` | 27-34：Step③④ 真实 UI |
| 11 | `phase11.md` | 35-41：Step⑤ Export + Schema Codegen + OAuth |
| 12 | `phase12.md` | 42-48：CLIBridge 三项目全链路串联 |
| 13 | `phase13.md` | 49-54：Docker + SQLite + E2E + LLM Prompts |

架构设计：`docs/design/2026-05-31-resume-ci-architecture-design.md`
