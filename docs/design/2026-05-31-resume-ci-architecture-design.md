# Resume CI — 全链路 AI 求职工作台架构设计

> 状态：设计完成，待进入实现计划阶段
> 日期：2026-05-31

---

## 一、项目定位

**混合定位**：既是个人的求职工作台（实际使用），也是可公开分享的开源项目（展示 AI 应用工程能力）。

### 一句话

从 JD 到一页 PDF 的全链路 AI 求职工具 — 找项目 → 做项目 → 整理表达 → 生成简历。

### 集成三个上游项目

```
shushu-internship-tool
  -> 规划 / 构建 / 理解一个能投递、能面试的项目

shushu-internship-resume-optimizer
  -> 把项目证据、业务背景和经历材料整理成可投递表达

VibeResume
  -> 让 AI 修改网页简历，并导出稳定的一页 PDF
```

### 双端交付

- **Web 端**：Next.js + FastAPI 云端部署，GitHub OAuth 登录
- **Desktop 端**：Electron 桌面应用，内嵌免安装 Python 环境，离线可用

---

## 二、架构宣言

> 这是一个基于 Monorepo 的双端同构 AI 架构：核心前端 UI、路由与画布逻辑 100% 封装在共享包中，通过 `IResumeCIAdapter` 接口（控制反转）解耦底层算力；Web 端由 Next.js 壳层引入并通过 WebSocket 连接云端 FastAPI 服务，Windows 桌面端由 Electron 壳层引入并通过安全的 IPC 桥梁调度主进程内嵌的免安装 Python 环境，从而让两端完美复用同一套核心逻辑、Python CLI 资产与基于统一事实来源自动生成的 JSON Schema 协议。

---

## 三、Monorepo 顶层结构

```
resume-ci/
├── apps/
│   ├── web/                         # Next.js 网站（云端部署）
│   │   ├── src/
│   │   │   ├── app/                 # Next.js App Router 页面
│   │   │   │   ├── layout.tsx       # 全局布局：字体、SEO meta
│   │   │   │   ├── page.tsx         # 唯一页面 → <ResumeCICore adapter={...} />
│   │   │   │   └── api/
│   │   │   │       └── auth/        # NextAuth.js：GitHub OAuth 登录
│   │   │   ├── adapters/
│   │   │   │   └── remote.adapter.ts    # WebSocket 实现
│   │   │   └── middleware.ts        # 路由保护
│   │   └── next.config.ts
│   │
│   └── desktop/                     # Electron 桌面应用（Windows）
│       ├── src/
│       │   ├── main/                # 主进程
│       │   │   ├── index.ts         # 入口：单实例锁、窗口初始化
│       │   │   ├── python-executor.ts   # Python 子进程管理
│       │   │   ├── python-bootstrap.ts  # 首次启动解压 Python 环境
│       │   │   └── window-manager.ts    # 窗口大小/位置
│       │   ├── preload/
│       │   │   └── preload.ts       # contextBridge 安全桥
│       │   ├── renderer/
│       │   │   └── App.tsx          # <ResumeCICore adapter={localAdapter} />
│       │   └── adapters/
│       │       └── local.adapter.ts # IPC 实现
│       ├── scripts/
│       │   ├── build-python-runtime.sh  # CI 构建预打包 Python 环境
│       │   └── python-runtime.spec      # 依赖清单
│       └── electron-builder.yml
│
├── packages/
│   ├── ui/                          # 共享 UI 组件库（React）
│   │   ├── wizard/                  # 向导步骤组件
│   │   ├── canvas/                  # 画布组件（简历 WYSIWYG）
│   │   ├── cards/                   # 项目卡片、闪卡等
│   │   ├── chat/                    # AI 对话面板
│   │   └── shared/                  # 按钮、输入框、动画等
│   │
│   ├── core/                        # 核心协议 & 业务逻辑（纯 TS，零依赖）
│   │   ├── schemas/
│   │   │   ├── source-of-truth.json     # 唯一 Schema 定义源
│   │   │   └── generated/
│   │   │       ├── types.ts             # 自动生成 TypeScript types
│   │   │       └── models.py            # 自动生成 Pydantic models
│   │   ├── types/
│   │   ├── adapters/
│   │   │   └── base.adapter.ts      # IResumeCIAdapter 接口定义
│   │   └── protocol/
│   │       └── messages.ts          # 统一消息信封类型
│   │
│   └── python-bridge/               # Electron 端 Python 调用封装
│       └── src/
│           └── cli-executor.ts
│
├── services/
│   └── fastapi/                     # FastAPI 核心服务（云端部署）
│       ├── app/
│       │   ├── routers/
│       │   │   └── ws.py            # WebSocket handler
│       │   ├── services/
│       │   │   └── pipeline.py      # 调用 3 个 Python CLI
│       │   └── schemas/
│       │       └── models.py        # Pydantic models（从 Schema 生成）
│       └── requirements.txt
│
└── scripts/                         # 三个 Python CLI（git submodule）
    ├── shushu-internship-tool/
    ├── shushu-internship-resume-optimizer/
    └── vibe-resume/
```

---

## 四、数据协议层：统一事实来源

### 4.1 设计原则

- **Schema 即文档**：JSON Schema 的 `description` 字段直接用于 UI tooltip 和 placeholder
- **双向生成**：改 `source-of-truth.json` → `npm run codegen` → 同时产出 TS 类型和 Pydantic models
- **WebSocket 消息信封**统一为 `{ type, id, data/result }`，所有流式事件走同一协议

### 4.2 核心数据模型

```
packages/core/schemas/
├── source-of-truth.json        # 唯一 Schema 定义源
├── generated/
│   ├── types.ts                # 自动生成 TypeScript types
│   └── models.py               # 自动生成 Pydantic models
└── codegen.ts                  # 代码生成脚本
```

#### JDParsed

```json
{
  "$defs": {
    "JDParsed": {
      "keywords": ["关键词 + 权重"],
      "techStack": ["技术栈列表"],
      "roleType": "后端 | 前端 | 算法 | 全栈 | 移动端 | 测试 | 数据 | DevOps | 安全 | 系统",
      "matchProfile": { "score": 0.92, "gaps": ["缺失项"] }
    }
  }
}
```

#### ProjectCard

```json
{
  "ProjectCard": {
    "id": "uuid",
    "title": "高并发IM即时通讯系统",
    "techStack": ["Go", "WebSocket", "Redis"],
    "jdMatchScore": 0.89,
    "architecture": "mermaid DSL 字符串",
    "challenges": ["FlashCard[]"],
    "runDepth": "smoke-test | local-full-run | interview-only"
  }
}
```

#### AlignmentSession

```json
{
  "AlignmentSession": {
    "projectId": "uuid",
    "questions": ["AlignmentQuestion[] — 一次一个"],
    "evidenceChain": ["STARBullet[] — 实时累积"],
    "gaps": ["还缺证据的维度"]
  }
}
```

#### ResumePage

```json
{
  "ResumePage": {
    "sections": ["Header | Experience | Projects | Skills | Education"],
    "htmlSource": "当前 index.html 内容",
    "pageFit": { "currentPages": 0.98, "status": "fit | overflow | underflow" }
  }
}
```

#### ExportPipeline

```json
{
  "ExportPipeline": {
    "stages": ["排版对齐 → 字体嵌入 → ATS校验 → 生成PDF"],
    "currentStage": "string",
    "interviewTip": "收尾锦囊"
  }
}
```

---

## 五、核心接口：IResumeCIAdapter

所有业务逻辑通过此接口定义，Web/Desktop 两端 100% 复用 UI，仅注入不同的 Adapter 实现。

```typescript
// packages/core/src/adapters/base.adapter.ts

interface IResumeCIAdapter {
  // === 第一步：JD 解析 ===
  parseJD(input: string): Promise<JDParsed>;
  
  // === 第二步：项目发现 & 审计 ===
  discoverProjects(jd: JDParsed): AsyncIterable<ProjectCard>;
  auditProject(repoUrl: string): AsyncIterable<AuditEvent>;
  getArchitectureDiagram(projectId: string): Promise<MermaidDSL>;
  getTechChallenges(projectId: string): Promise<FlashCard[]>;
  
  // === 第三步：证据对齐 ===
  generateAlignmentQuestions(project: ProjectCard): AsyncIterable<AlignmentQuestion>;
  submitAlignmentAnswer(questionId: string, answer: string): AsyncIterable<STARBullet>;
  
  // === 第四步：简历编辑 ===
  getResumeHTML(): Promise<string>;
  updateResumeSection(section: string, content: string): Promise<void>;
  aiPolish(text: string, style: string): AsyncIterable<string>;
  checkPageFit(): Promise<PageFitStatus>;
  
  // === 第五步：导出 ===
  exportPDF(): AsyncIterable<ExportProgress>;
  
  // === 生命周期 ===
  cancel(id: string): void;
  send(method: string, params: Record<string, unknown>): string;
}
```

### 两端注入方式

```typescript
// Web 端
// apps/web/src/app/page.tsx
import { ResumeCICore } from '@resume-ci/ui';
import { remoteAdapter } from '@/adapters/remote.adapter';
export default function Page() {
  return <ResumeCICore adapter={remoteAdapter} />;
}

// Desktop 端
// apps/desktop/src/renderer/App.tsx
import { ResumeCICore } from '@resume-ci/ui';
import { localAdapter } from '../adapters/local.adapter';
export default function App() {
  return <ResumeCICore adapter={localAdapter} />;
}
```

---

## 六、流式通信协议

### 6.1 统一消息信封

```typescript
// packages/core/src/protocol/messages.ts

/** 客户端 → 服务端 */
type ClientMessage =
  | { type: 'cmd'; id: string; method: string; params: Record<string, unknown> }
  | { type: 'cancel'; id: string };

/** 服务端 → 客户端 */
type ServerMessage =
  | { type: 'ack'; id: string }
  | { type: 'chunk'; id: string; data: unknown; seq: number }
  | { type: 'done'; id: string; result: unknown }
  | { type: 'err'; id: string; code: string; message: string; partial?: unknown };
```

### 6.2 关键设计决策

1. **`done.result` 永远不为 null**：对于流式方法，`result` 是所有 chunk 聚合后的完整对象，前端无需二次组装
2. **`err.partial` 携带半成品**：出错时也返回已收集的 chunk 聚合结果，前端可展示部分完成的内容
3. **`chunk.seq` 是单调递增序号**：前端检测丢包和乱序，支持断点续传

### 6.3 方法映射

```typescript
const METHOD_MAP = {
  'jd.parse':              { params: { raw: 'string' }, stream: false },
  'project.discover':      { params: { jd: 'JDParsed' }, stream: true },
  'project.audit':         { params: { repoUrl: 'string' }, stream: true },
  'project.diagram':       { params: { projectId: 'string' }, stream: false },
  'project.challenges':    { params: { projectId: 'string' }, stream: false },
  'alignment.questions':    { params: { projectId: 'string' }, stream: true },
  'alignment.answer':       { params: { questionId, answer }, stream: true },
  'resume.get':            { params: {}, stream: false },
  'resume.update':         { params: { section, content }, stream: false },
  'resume.polish':         { params: { text, style }, stream: true },
  'resume.fit':            { params: {}, stream: false },
  'export.pdf':            { params: {}, stream: true },
} as const;
```

### 6.4 Cancel 全链路

```
前端 cancel(id)
  → Adapter.send({ type: 'cancel', id })
    → Web 端: ws.send(cancel)         Desktop 端: IPC → proc.stdin.write(cancel)
      → FastAPI ws_handler             → Python server stdin 读取
        → asyncio.Task.cancel()          → asyncio.Task.cancel()
        → proc.terminate() → kill()      → proc.terminate() → kill()
        → LLM client.close()             → LLM client.close()
```

详见 [第八节：修正记录](#八修正记录) 修正 3。

---

## 七、五步交互流程

### Wizard 状态机

```typescript
type WizardStep = 'anchor' | 'blueprint' | 'alignment' | 'polish' | 'export';

interface WizardState {
  step: WizardStep;
  jd: JDParsed | null;
  selectedProject: ProjectCard | null;
  alignmentSession: AlignmentSession | null;
  resume: ResumePage | null;
  canGoBack: boolean;
  canGoForward: boolean;
  visitedSteps: Set<WizardStep>;
}
```

### Step 1：锚点输入（Anchor）

- **交互**：粘贴 JD → 分屏展示关键词高亮 + 匹配雷达图
- **技术**：大输入框 → `adapter.parseJD()` → Canvas 粒子动画逐词绽放
- **组件**：`SplitPane` + `JDInputArea` + `KeywordCloud` + `MatchRadar`

### Step 2：项目蓝图（Blueprint）

- **交互**：3 张项目卡片选一张 → 展开架构图（Mermaid SVG）+ 技术挑战闪卡
- **技术**：`adapter.discoverProjects()` 流式返回卡片 → 选中后展开 `ProjectDeepDive`
- **组件**：`ProjectCardSelector` + `ProjectCard` ×3 + `ArchitectureDiagram` + `FlashCardStack`

### Step 3：证据对齐（Alignment）

- **交互**：一次一道选择题/填空题 → 回答后右侧实时生长 STAR 证据链
- **技术**：`adapter.generateAlignmentQuestions()` → 每答一题调 `submitAlignmentAnswer()` → 流式返回 STAR bullet
- **组件**：`QuestionFlow` + `OptionGroup` + `EvidenceChain` + `STARBullet`

### Step 4：沉浸精修（Polish）★ 最核心

- **交互**：左侧 AI 对话（可折叠）+ 右侧 WYSIWYG 简历画布
  - 双击编辑文字（contentEditable）
  - 划选文字弹出 AI 悬浮条（Polish/Expand/Shorten）
  - 右下角单页指示器（0.98/1.0 页 → 绿色，"完美"）
- **技术**：`adapter.getResumeHTML()` 渲染为可编辑画布，实时计算 `.page` 高度 vs A4 比例
- **组件**：`ResumeCanvas` + `InlineEditor` + `SelectionFloatingBar` + `PageIndicator` + `AIChat` + `QuickCommands`

### Step 5：仪式导出（Export）

- **交互**：三步流水线进度动画 → PDF 预览 + 下载按钮 → 面试锦囊彩蛋
- **技术**：`adapter.exportPDF()` 流式返回阶段进度 → 完成后展示下载链接
- **组件**：`PipelineProgress` + `PDFPreview` + `DownloadButton` + `InterviewTip`

---

## 八、修正记录

### 修正 1：Electron 安全沙箱

**问题**：Renderer 直接 `spawn` Python 进程，绕过 Chromium 沙箱。

**修正**：
- Python 子进程管理必须放在 **Main Process**（`python-executor.ts`）
- Renderer 只能通过 **Preload 层** 的 `contextBridge.exposeInMainWorld('api', { send, cancel, onMessage })` 有限方法通信
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`

**架构**：
```
Renderer Process (沙箱)    Preload (安全桥)         Main Process
┌──────────┐  window.api ┌──────────────┐  IPC  ┌───────────┐
│ UI 组件   │◄──────────►│ contextBridge │◄────►│ Python    │
│ adapter  │             │ .exposeInMain │      │ 子进程     │
└──────────┘             └──────────────┘      └───────────┘
```

### 修正 2：流式末尾携带最终态结果

**问题**：`done` 事件的 `result` 为 null，前端无法获取聚合后的完整对象。

**修正**：
- `done.result` 必须携带流式聚合后的完整最终对象
- Python 侧 `_aggregate(chunks)` 根据方法类型聚合 chunk
- `err.partial` 同时携带已收集的半成品

### 修正 3：Cancel 信号全链路联动

**问题**：客户端 cancel 后，后端仍在跑任务浪费 Token。

**修正**：
- Python 侧维护 `active_tasks` 和 `active_procs` 字典
- cancel 到达时：`Task.cancel()` → `proc.terminate()` → 超时则 `proc.kill()` → LLM client.close()
- 前端步骤回退时主动调用 `adapter.cancel(id)`

### 修正 4：Desktop 端免安装 Python 运行时的正确打包方式

**问题**：
1. `afterInstall` 钩子写 `C:\Program Files\` 需要管理员权限
2. 用户电脑 `pip install` 依赖网络和镜像源
3. 不是真正"一开即用"

**修正**：
- CI 构建时用 **Windows Python Embeddable Package** 预构建完整 venv → 打包为 `python-runtime.zip`
- 首次启动时解压到 `%LOCALAPPDATA%\ResumeCI\python\`（永远可写，无需管理员）
- 用户端零网络、零 pip，安装完即用

**时序**：
```
用户双击 Resume CI.exe
  → ensurePythonRuntime()
    → 检查 %LOCALAPPDATA%\ResumeCI\python\python.exe 存在？
      → YES → validateRuntime() → 就绪（~0ms）
      → NO  → 从 resources\python-runtime.zip 解压 → 就绪（~5-10s）
  → PythonExecutor.start() → spawn python.exe
  → WindowManager.createMainWindow() → 渲染 UI
```

**构建体积估算**：
| 组件 | 大小 |
|------|------|
| Python 3.12 embeddable | ~8 MB |
| fastapi + uvicorn + pydantic | ~15 MB |
| openai / anthropic SDK | ~5 MB |
| 三个 CLI 依赖 | ~3 MB |
| 三个 CLI 源码 + FastAPI 服务 | ~2 MB |
| **python-runtime.zip 总计** | **~35 MB** |
| Electron + Chromium + UI 产物 | ~180 MB |
| **NSIS 安装包（压缩后）** | **~100 MB** |

---

## 九、两端差异对照

| 维度 | Web 端 | Desktop 端 |
|------|--------|------------|
| **入口** | `apps/web/src/app/page.tsx` | `apps/desktop/src/renderer/App.tsx` |
| **Adapter** | `RemoteAdapter(WebSocket)` | `LocalAdapter(IPC)` |
| **路由** | Next.js App Router | 单一 SPA（无路由） |
| **认证** | NextAuth.js (GitHub OAuth) | 无（本地应用） |
| **Python 运行时** | 云端 FastAPI 服务 | 本地内嵌 Embeddable Python |
| **部署** | Vercel / Docker | Electron Builder → .exe NSIS 安装包 |
| **核心 UI** | `@resume-ci/ui` | `@resume-ci/ui`（100% 相同） |
| **协议** | `@resume-ci/core` | `@resume-ci/core`（100% 相同） |

---

## 十、Monorepo 构建工具链

### 10.1 包管理器选型

选 **pnpm**，三个关键原因：

1. **strict workspace linking**：`packages/ui` 如果没在 `package.json` 里声明 `react` 为 dependency，就绝对 import 不到 — 杜绝幽灵依赖
2. **原生 workspace protocol**：`"@resume-ci/core": "workspace:*"` → publish 时自动替换为真实版本号
3. **比 npm/yarn 快 2-3x** 的安装速度（对 CI 有意义）

```
pnpm-workspace.yaml
├── packages/*      # @resume-ci/core, @resume-ci/ui, @resume-ci/python-bridge
├── apps/*          # @resume-ci/web, @resume-ci/desktop
└── services/*      # fastapi（只放 Python，不参与 Node workspace）
```

### 10.2 包解析策略：本地工程透明映射

采用三件套协同，保证 dev 模式下所有包零构建、直读源码：

```jsonc
// packages/core/package.json
{
  "name": "@resume-ci/core",
  "main": "./src/index.ts",        // Vite/esbuild/tsx 直接吃
  "types": "./src/index.ts",       // IDE 直接跳源码
  "exports": {
    ".": {
      "development": "./src/index.ts",   // dev 模式直读源码
      "default": "./dist/index.js"       // 生产/CI 用构建产物
    }
  }
}
```

```jsonc
// tsconfig.base.json（仓库根）
{
  "compilerOptions": {
    "paths": {
      "@resume-ci/core":     ["./packages/core/src/index.ts"],
      "@resume-ci/core/*":   ["./packages/core/src/*"],
      "@resume-ci/ui":       ["./packages/ui/src/index.ts"],
      "@resume-ci/ui/*":     ["./packages/ui/src/*"]
    }
  }
}
```

```js
// apps/web/next.config.ts — Next.js 壳层唯一额外配置
const nextConfig = {
  transpilePackages: ["@resume-ci/core", "@resume-ci/ui"],
};
```

**三层防护兜底**：

| 层 | 机制 | 效果 |
|----|------|------|
| 1 | `tsconfig paths` 别名 | IDE 跳转、tsc 类型检查直接命中原文件 |
| 2 | `exports.development` 条件 | Vite/esbuild/Turbopack 在 dev 模式下直读 `.ts` 源码 |
| 3 | `transpilePackages`（仅 Next.js） | 确保 Next.js SWC 编译器知道去编译 workspace 包的 TS |

**各壳层实际效果**：

| 场景 | 用什么 | 是否需配置 |
|------|--------|-----------|
| IDE (VS Code) | `paths` 别名 → 直接跳 `src/index.ts` | 零配置 |
| Vitest | Vite 原生识别 `exports.development` | 零配置 |
| Next.js dev | `transpilePackages` + `paths` | 一行配置 |
| Electron (Vite) | Vite 原生识别，直接吃 `src/*.ts` | 零配置 |
| CI tsc --noEmit | `paths` 别名 → 类型检查全链路 | 零配置 |
| 未来 publish | `exports.default` → `dist/index.js` | 构建步骤产 `dist/` |

### 10.3 依赖图与拓扑排序

```
                    ┌──────────────────┐
                    │  source-of-truth  │
                    │     .json         │  ← 唯一的 Schema 定义源
                    └────────┬─────────┘
                             │ codegen 生成
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌───────────┐   ┌────────────┐  ┌──────────────┐
     │ TS types  │   │ Pydantic   │  │ JSON Schema  │
     │ (.ts)     │   │ (.py)      │  │ (供文档/校验) │
     └─────┬─────┘   └─────┬──────┘  └──────────────┘
           │               │
           ▼               ▼
   ┌──────────────┐  ┌──────────────────┐
   │ @resume-ci/  │  │ services/fastapi │
   │    core      │  │  app/schemas/    │
   │  协议+类型    │  │  models.py       │
   └──────┬───────┘  └────────┬─────────┘
          │                   │
    ┌─────┼───────────┐       │
    ▼     ▼           ▼       ▼
┌────────┐ ┌──────────┐ ┌──────────────┐
│   ui   │ │ python-  │ │  pipeline.py │
│ 组件库  │ │ bridge   │ │  (调3个CLI)  │
└───┬────┘ └────┬─────┘ └──────┬───────┘
    │           │              │
    ▼           ▼              │
┌────────┐ ┌──────────┐       │
│  web   │ │ desktop  │       │
│ Next.js│ │ Electron │◄──────┘
└────────┘ └──────────┘
    │           │
    ▼           ▼
   WebSocket   IPC + stdio
    │           │
    └─────┬─────┘
          ▼
   ┌──────────────┐
   │  FastAPI     │
   │  (云端部署)   │
   └──────────────┘
```

**包间依赖关系**：

| 包名 | 依赖 | 被依赖 |
|------|------|--------|
| `@resume-ci/core` | **无（零依赖）** | `ui`, `python-bridge`, `web`, `desktop` |
| `@resume-ci/ui` | `core`, `react`, `react-dom` | `web`, `desktop` |
| `@resume-ci/python-bridge` | `core` | `desktop` (仅 main process) |
| `@resume-ci/web` | `core`, `ui` | — |
| `@resume-ci/desktop` | `core`, `ui`, `python-bridge` | — |
| `services/fastapi` | 三个 CLI (git submodule) | — |

**核心设计：`core` 是唯一零依赖包** — 不依赖 React、不依赖 Node API、不依赖任何第三方库。这意味着它可以在任何 JS 运行时使用（包括未来的 VS Code 插件、CLI 工具等），不会被框架绑架。

**Turborepo 构建拓扑**：当运行 `turbo build` 时，根据 `dependsOn: ["^build"]` 自动排序：

```
Phase 1 (并行):     core:build
                        │
Phase 2 (并行):     ui:build ── python-bridge:build
                        │              │
Phase 3 (并行):     web:build    desktop:build
```

如果只改 `packages/ui` 里一个组件的 CSS → Turborepo 的缓存命中 `core` → 只重构建 `ui` → `web` 和 `desktop` 只重新打包壳（秒级）。

### 10.4 Turborepo 任务编排

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  
  "tasks": {
    // ─── 构建任务（有依赖顺序）───
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    
    // ─── 类型检查（依赖 .d.ts）───
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    },
    
    // ─── 开发服务器（不缓存）───
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false,
      "concurrency": 3
    },
    
    // ─── 测试（完全并行）───
    "test": {
      "dependsOn": [],
      "cache": true,
      "inputs": ["src/**", "test/**", "**/*.test.*"]
    },
    
    // ─── 代码检查 ───
    "lint": {
      "dependsOn": [],
      "cache": true
    },
    
    // ─── Schema 代码生成 ───
    "codegen": {
      "dependsOn": [],
      "outputs": [
        "packages/core/src/schemas/generated/**",
        "services/fastapi/app/schemas/generated/**"
      ],
      "cache": true
    },
    
    // ─── Desktop 打包（CI only）───
    "desktop:package": {
      "dependsOn": ["build", "python:runtime:build"],
      "outputs": ["apps/desktop/dist-electron/**"],
      "cache": false
    },
    
    "python:runtime:build": {
      "dependsOn": [],
      "outputs": ["python-runtime.zip"],
      "cache": false
    }
  }
}
```

### 10.5 开发体验全景

**一条命令起全栈**：

```bash
pnpm dev   # 根目录
```

背后 `turbo dev` + `concurrently` 并行启动三个进程：

```
┌───────────────────────────────────────────────────────────────────┐
│                        pnpm dev                                    │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ Next.js Dev  │  │ Electron Dev │  │ FastAPI Dev                │ │
│  │ localhost:    │  │ (Vite HMR)   │  │ localhost:8000              │ │
│  │ 3000          │  │              │  │ --reload 热重载             │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────────┬──────────────┘ │
│         │                 │                         │                │
│         └──────────── WebSocket ◄───────────────────┘                │
│                      ws://localhost:8000/ws                          │
└───────────────────────────────────────────────────────────────────┘
```

**热更新链路**：

| 改动 | Web 端 | Desktop 端 | 耗时 |
|------|--------|------------|------|
| 改 `@resume-ci/core` types | tsc --watch 增量重检 | tsc --watch 增量重检 | ~1s |
| 改 `@resume-ci/ui` 组件 | Next.js Fast Refresh | Vite HMR | ~200ms，双端同时 |
| 改 `services/fastapi` pipeline | uvicorn --reload → WebSocket 重连 | uvicorn --reload → WebSocket 重连 | ~2s |
| 改 Electron main process | 不适用 | electron-vite 主进程重启，窗口不丢 | ~1s |

**根 `package.json` 脚本**：

```json
{
  "scripts": {
    "dev": "concurrently -n web,desktop,fastapi -c cyan,magenta,yellow \"pnpm dev:web\" \"pnpm dev:desktop\" \"pnpm dev:fastapi\"",
    "dev:web": "turbo run dev --filter=@resume-ci/web",
    "dev:desktop": "turbo run dev --filter=@resume-ci/desktop",
    "dev:fastapi": "cd services/fastapi && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
    
    "dev:web-only": "turbo run dev --filter=@resume-ci/web...",
    "dev:desktop-only": "turbo run dev --filter=@resume-ci/desktop..."
  }
}
```

**首次启动 vs 日常开发**：

```
首次 clone → pnpm install → pnpm codegen → pnpm dev
                        │
                  codegen 从 source-of-truth.json
                  生成 TS types + Pydantic models
                  耗时：~3s（一次性）

日常 dev → turbo 缓存命中 core → Next.js 冷启动 ~3s
                                → Electron 冷启动 ~2s
                                → FastAPI 冷启动 ~2s
                                总计：~5s 全部就绪

只改 UI 组件 → 保存 → HMR 200ms → 双端同时刷新
不需要任何构建步骤
```

**Desktop 开发时的 Python 路径**：

```typescript
// apps/desktop/src/main/python-executor.ts
function getPythonPath(): string {
  if (import.meta.env.DEV) {
    // 开发模式：直接用本地 .venv
    return path.resolve(projectRoot, 'services/fastapi/.venv/Scripts/python.exe');
  }
  // 生产模式：用 %LOCALAPPDATA% 的解压后 runtime
  return getPythonRuntimePath();
}
```

这样 Desktop 开发时改 `pipeline.py` → FastAPI uvicorn reload → Electron 窗口即时感知。

### 10.6 CI/CD 流水线

**总体构建矩阵**：一个 workflow，四个并行 Job：

```
push to main / PR
        │
        ├── Job 1: Quality Gates (fast, ~2min)
        │     ├── pnpm install --frozen-lockfile
        │     ├── turbo codegen
        │     ├── turbo typecheck
        │     ├── turbo lint
        │     └── turbo test
        │
        ├── Job 2: Web Deploy (~6min, depends on Quality Gates)
        │     ├── turbo build --filter=@resume-ci/web
        │     └── deploy to Vercel
        │
        ├── Job 3: Desktop Build Windows (~18min, depends on Quality Gates)
        │     ├── bash scripts/build-python-runtime.sh
        │     ├── turbo build --filter=@resume-ci/desktop
        │     ├── electron-builder (NSIS .exe)
        │     └── upload artifact (installer)
        │
        └── Job 4: Python Tests (~4min, depends on Quality Gates)
              ├── pip install requirements
              └── pytest
```

#### Quality Gates 绝对阻断规约

```
                    ┌─────────────────────────┐
                    │   Job 1: Quality Gates   │
                    │                          │
                    │  codegen → typecheck →   │
                    │  lint → test              │
                    │                          │
                    │  ✅ 全部通过？            │
                    └──────┬──────────┬────────┘
                           │ YES      │ NO (任一步挂)
                           ▼          ▼
              ┌────────────┐    ┌─────────────────┐
              │ 下游全部起跑 │    │ 下游全部 Skipped  │
              │            │    │                  │
              │ Job 2: Web │    │ Job 2: Skipped   │
              │ Job 3: Win │    │ Job 3: Skipped   │
              │ Job 4: Py  │    │ Job 4: Skipped   │
              └────────────┘    └─────────────────┘
                                       │
                                       ▼
                              💰 节省 Windows ×2 分钟费率
                                 节省重型构建分钟数
```

**规约条款**：

| # | 规约 | 理由 |
|---|------|------|
| **G-1** | 所有下游 Job 必须声明 `needs: [quality]` | 强制串行依赖，Quality 不过则全部 Skipped |
| **G-2** | Job 1 内任一步 `exit code ≠ 0` 立即终止 Job | `set -e` + `shell: bash` 确保 step 级阻断 |
| **G-3** | 禁止在下游 Job 中用 `if: always()` 绕过 | 即使手动触发 preview deploy，也必须 Quality 通过 |
| **G-4** | Windows Job 必须设置 `timeout-minutes: 30` | Windows runner 费率 ×2，超时硬限制防止跑飞 |
| **G-5** | 每个 PR 只允许一次 CI 运行 | `concurrency.cancel-in-progress: true` 保证新 push 自动 kill 旧的 |

**成本节省**：

| 场景 | 无阻断 | 有阻断 |
|------|--------|--------|
| typecheck 挂 | Ubuntu 10 + Windows 30(×2) + Python 4 ≈ 74 计费分钟 | Ubuntu 2min ≈ 2 计费分钟 |
| test 挂 | 同上，Windows 白跑 | 同上，省 ~60 分钟 |
| 全部通过 | 正常运行 | 几乎无额外开销 |

每阻止一个坏 PR 进 Windows 构建，节省约 60 计费分钟（×2 费率 = 120 分钟额度）。

#### CI 配置文件骨架

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ─── Job 1: Quality Gates（总闸）───
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        shell: bash
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Schema Codegen
        run: pnpm turbo run codegen
      - name: Type Check
        run: pnpm turbo run typecheck
      - name: Lint
        run: pnpm turbo run lint
      - name: Unit Tests
        run: pnpm turbo run test
      - uses: actions/cache/save@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}

  # ─── Job 2: Web Deploy ───
  web:
    needs: [quality]
    if: success()
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production
      url: https://resume-ci.com
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
      - run: pnpm install --frozen-lockfile
      - name: Build Web
        run: pnpm turbo run build --filter=@resume-ci/web
        env:
          NEXT_PUBLIC_API_HOST: ${{ vars.API_HOST }}
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  # ─── Job 3: Desktop Build (Windows) ───
  desktop:
    needs: [quality]
    if: success()
    runs-on: windows-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}
      - run: pnpm install --frozen-lockfile
      - name: Build Python Runtime
        shell: bash
        run: bash apps/desktop/scripts/build-python-runtime.sh
      - name: Upload Python Runtime Artifact
        uses: actions/upload-artifact@v4
        with:
          name: python-runtime
          path: python-runtime.zip
      - name: Build Desktop
        run: pnpm turbo run build --filter=@resume-ci/desktop
      - name: Package Electron
        run: pnpm turbo run desktop:package --filter=@resume-ci/desktop
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload Installer
        uses: actions/upload-artifact@v4
        with:
          name: ResumeCI-Setup.exe
          path: apps/desktop/dist-electron/*.exe

  # ─── Job 4: Python Tests ───
  python-tests:
    needs: [quality]
    if: success()
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install Dependencies
        run: |
          pip install -r services/fastapi/requirements.txt
          pip install -r scripts/shushu-internship-tool/requirements-dev.txt || true
          pip install -r scripts/shushu-internship-resume-optimizer/requirements-dev.txt || true
      - name: Run Python Tests
        run: pytest scripts/*/tests/ services/fastapi/tests/ -v
```

#### 分支策略与版本号

```
main 分支：
  push → CI 全跑 → Web 自动部署生产 → Desktop 发布 draft release

PR 分支：
  push → CI 只跑 quality + python-tests（Web/Desktop 构建跳过）
  → 节省 CI 分钟数，PR 上只展示类型/测试结果

tag v1.0.0：
  push → CI 全跑 → Desktop 发布正式 release（带 release notes）
```

#### CI 缓存层级

| 缓存 | 命中条件 | 典型耗时 |
|------|---------|---------|
| turbo build cache | 代码 + 依赖没变 | 秒级 |
| pnpm store cache | lockfile 没变 | ~30s |
| Python pip cache | requirements.txt 没变 | ~20s |
| electron-builder cache | electron-builder.yml 没变 | ~30s |

### 10.7 技术选型决策

以下 7 个之前标记为「待决策」的技术选型，在本次设计讨论中确定：

| # | 项目 | 选择 | 理由 |
|---|------|------|------|
| 1 | 组件库 | **Tailwind CSS + shadcn/ui** | 成熟生态，组件可定制，与 React 19 兼容 |
| 2 | 状态管理 | **Zustand** | 单一 Store 模型适合 Wizard 状态机，比 Jotai 更简单 |
| 3 | 动画 | **Framer Motion** | React 最佳动画方案，layout animations 天然支持步骤切换 |
| 4 | Mermaid 渲染 | **客户端 `mermaid` npm 包** | 架构图无需服务端预渲染，浏览器直接解析 DSL |
| 5 | FastAPI 部署 | **Docker 单容器** | MVP 阶段够用；K8s 留待 V2 |
| 6 | CI/CD | **GitHub Actions** | 免费额度充足，与仓库同平台 |
| 7 | 测试 | **Vitest + pytest + Playwright** | 覆盖 UI 单测、Python 逻辑、E2E 全链路 |
