# Resume CI — Phase 9 真实 UI 组件设计

> 状态：设计完成，待审阅
> 日期：2026-06-01
> 范围：Step ① Anchor 锚点输入 + Step ② Blueprint 项目蓝图

---

## 一、设计决策

### 1.1 组件策略：混合方案

- **基础交互**（Button、Input、Badge、Card、Dialog、HoverCard、Skeleton、Tooltip）：shadcn/ui copy source，全局统一主题化
- **特征交互**（ProjectCard 3D 堆叠、KeywordCloud 粒子动画、Mermaid 架构图、FlashCard 翻转）：独立手写，仅依赖 Tailwind CSS + Framer Motion

### 1.2 视觉风格：温暖亲近（Warm & Organic）

米白暖灰基调，圆角梯度，微妙毛玻璃，莫兰迪色系标签。模拟纸质简历质感，营造沉浸式沙箱氛围。

### 1.3 数据策略：同步接入后端

Phase 9 同时升级 MockAdapter（丰富假数据）和 FastAPI PipelineService（接入 shushu-internship-tool CLI），UI 组件从真实数据流中驱动。

### 1.4 相位的拆分

| Phase | 范围 |
|-------|------|
| **Phase 9**（本文档） | ① Anchor + ② Blueprint |
| Phase 10 | ③ Alignment + ④ Polish |
| Phase 11 | ⑤ Export |

---

## 二、数据层设计

### 2.1 JD 解析：一次性 JSON 返回

JDInputArea 防抖 1.5s → 一次性请求 `adapter.parseJD(raw)` → 前端做打字机动画模拟流式感。

**理由**：JDParsed 包含强结构化数据（weights、gaps 数组），流式传输会导致 JSON.parse 报错，且雷达图无法渲染「半个属性」。

```
用户粘贴 JD
  → JDInputArea (防抖 1.5s)
    → 立刻展示 Loading 动画（毛玻璃遮罩 + 脉冲圆环）
    → adapter.parseJD(raw)  ← 一次性请求
      → FastAPI → LLM 结构化提取
    ← 一次性返回 JDParsed（~2-4s）
  → WizardStore.jd = result
  → 前端打字机动画逐词绽放 KeywordCloud（纯 UI 效果）
```

### 2.2 项目发现：真正的流式 SSE + 骨架屏

```
adapter.discoverProjects(jd)
  → WebSocket → FastAPI PipelineService.discover(jd)
    → GitHub search → 取前 5 个候选
    → for each repo: smoke-test audit → yield ProjectCard
  → 前端：
     t=0    → 3 张 Skeleton 骨架屏（固定 grid-cols-3）
     t=8s   → Card 1 arrive → Skeleton 1 渐隐 → Card 1 淡入（原位）
     t=14s  → Card 2 arrive → Skeleton 2 渐隐 → Card 2 淡入（原位）
     t=22s  → Card 3 arrive + done 事件
```

**关键规则**：第 1 张卡片到达后即可点击选择，无需等全部到达。选中后通过 `cancel(id)` 中断后端剩余审计。

### 2.3 WizardStore 状态扩展

```typescript
interface WizardState {
  step: WizardStep;
  jd: JDParsed | null;
  selectedProjectId: string | null;         // 新增 — 解耦卡片点击和组件请求
  projects: ProjectCard[];                  // 新增 — 流式累积
  projectsLoading: 'idle' | 'loading' | 'done';  // 新增 — 骨架屏状态
  alignmentSession: AlignmentSession | null;
  resume: ResumePage | null;
  canGoBack: boolean;
  canGoForward: boolean;
  visitedSteps: Set<WizardStep>;
}
```

**架构约束**：`ArchitectureDiagram` 和 `FlashCardStack` 被动监听 `selectedProjectId` 变化，卡片组件只负责设置此 ID，不直接触发请求。

### 2.4 数据流全景

```
Step ① Anchor                              Step ② Blueprint

  ┌──────────┐   一次性    ┌──────────┐       流式(SSE)   ┌─────────┐
  │JDInputArea│──────────→│ parseJD  │                   │discover │
  │ +Loading  │←──────────│          │                   │Projects │
  └──────────┘  JDParsed  └──────────┘                   └────┬────┘
       │                                                        │
       ▼                                                   yield 逐个
  ┌──────────┐                                          ┌────▼──┐
  │KeywordCloud│  WizardStore                    ┌───│Card 1 │
  │(打字机动画)│  .jd ──────────────────────────→│   └───────┘
  └──────────┘                                    │   ┌───────┐
       │                                          ├──│Card 2 │
       ▼                                          │   └───────┘
  ┌──────────┐                                    │   ┌───────┐
  │MatchRadar│                                    └──│Card 3 │
  └──────────┘                                        └───────┘
                                                         │
                                                    用户点击卡片
                                                         │
                                              WizardStore
                                              .selectedProjectId
                                                    │
                                          ┌─────────┴─────────┐
                                          ▼                   ▼
                                   ┌────────────┐  ┌──────────┐
                                   │Architecture│  │FlashCard │
                                   │Diagram     │  │Stack     │
                                   └────────────┘  └──────────┘
```

---

## 三、Step ① Anchor — 组件设计

### 3.1 JDInputArea

**职责**：接收 JD 文本，触发 AI 解析。

```
┌─────────────────────────────────────────────────────────┐
│  📋 粘贴职位描述 (Job Description)                       │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │                                                     ││
│  │  textarea: min-h-[5rem], max-h-[15rem],             ││
│  │  自适应高度，等宽字体，placeholder 显示示例文本       ││
│  │                                                     ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [🎤 语音输入]  [📎 上传截图 OCR]     [⚡ 解析 →]        │
│                                                         │
│  字数：187   ✓ 建议至少 150 字以获得更精准的匹配         │
└─────────────────────────────────────────────────────────┘
```

**状态机**：
```
idle → (打字中) → debounce 1.5s → pending → loading → success | error
                      │
                手动点击「⚡ 解析」跳过防抖
```

**Loading 态**：整个输入区上浮毛玻璃遮罩（`backdrop-blur-sm` + `glass-bg`），中央脉冲圆环 + "AI 正在理解 JD…"，背面文字轻微模糊。

**字数提示**：< 150 字显示温和提醒，≥ 150 字显示绿色勾。

### 3.2 KeywordCloud

**职责**：将 keywords 数组渲染为权重驱动的莫兰迪色系标签云，打字机逐词入场。

**视觉规则**：
- `weight > 0.8`：`text-lg` + 深色填充 + `font-bold`
- `weight 0.5-0.8`：中号 + 浅色填充
- `weight < 0.5`：小号 + 仅描边

**莫兰迪色系（WCAG AA, contrast ≥ 4.5:1）**：
```css
.tag-language     { bg: hsl(210 45% 82%); color: hsl(215 70% 28%); }
.tag-architecture { bg: hsl(270 35% 85%); color: hsl(270 50% 30%); }
.tag-middleware    { bg: hsl(155 30% 82%); color: hsl(160 55% 22%); }
.tag-devops       { bg: hsl(25 50% 83%);  color: hsl(20 65% 28%);  }
.tag-concept      { bg: hsl(35 28% 84%);  color: hsl(32 30% 30%);  }
```

**入场动画**：Framer Motion `staggerChildren: 0.08`，高权重词先出现（按 weight 降序渲染），每个标签 `opacity: 0 + translateY(12px)` → `opacity: 1 + translateY(0)`。

### 3.3 MatchRadar

**职责**：展示匹配度雷达图 + 缺口分析 + 修复建议。

**雷达图**：纯 SVG 实现，5 维度轴（语言匹配、架构匹配、中间件匹配、DevOps 匹配、深度匹配），顶点从中心向外伸展动画 0.8s。如果后端只提供总分，降级为圆环进度图。

**缺口列表**：每个 gap 自动生成温和建议，如 "缺少消息队列实战经验" → "💡 建议：选择一个包含消息队列的项目来弥补"。建议通过 shadcn/ui `HoverCard` 展开详细解释。

---

## 四、Step ② Blueprint — 组件设计

### 4.1 ProjectCard ×3（固定 Grid + 原地替换）

**容器**：`grid grid-cols-3 gap-6` — 一开始就锁定，永不变更。

**流式替换机制**：
```
t=0    3 张 Skeleton（暖卡其灰脉冲，尺寸与真实卡片完全一致）
t=8s   Skeleton[0] → opacity 0  + Card[0] → opacity 1（交叉淡入淡出，位置不动）
t=14s  Skeleton[1] → opacity 0  + Card[1] → opacity 1
t=22s  Skeleton[2] → opacity 0  + Card[2] → opacity 1

实现：Framer Motion AnimatePresence，layout prop 不设
```

**卡片内容**：
- 项目标题（大字 bold）+ 一句话描述
- JD 匹配分数（彩色圆环徽章：>85% 绿，70-85% 黄）
- 技术栈 Badge 行（匹配 JD 的技术用莫兰迪高亮色）
- [查看详情] 按钮 → 展开下方 ArchitectureDiagram + FlashCardStack

**选中态**：边框变 accent 色 + 顶部浮现勾标记 + `scale: 1.03` + 阴影加深 → 设置 `WizardStore.selectedProjectId = id`。

**Skeleton 暖色化**（替代 shadcn/ui 默认冷灰）：
```css
.skeleton {
  background: hsl(30 10% 90%);
  background-image: linear-gradient(
    90deg,
    hsl(30 10% 90%) 0%,
    hsl(36 14% 94%) 40%,
    hsl(30 10% 90%) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 2s ease-in-out infinite;
}
```

### 4.2 ArchitectureDiagram

**职责**：Mermaid DSL → 客户端渲染为可交互 SVG + 缩放/拖拽 + 节点点击。

**渲染工程化**：
```typescript
const MermaidDiagram = ({ dsl, projectId }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgId = `mermaid-${projectId}`; // 唯一 ID，切换强制重绘

  useEffect(() => {
    let panZoom: SvgPanZoom | null = null;
    // 1. 清空 → 避免 DOM 污染
    if (containerRef.current) containerRef.current.innerHTML = '';
    // 2. 渲染
    mermaid.render(svgId, dsl).then(({ svg }) => {
      containerRef.current!.innerHTML = svg;
      // 3. 绑定 pan-zoom
      const svgEl = containerRef.current!.querySelector('svg');
      if (svgEl) panZoom = svgPanZoom(svgEl, { zoomEnabled: true, minZoom: 0.5, maxZoom: 3 });
    });
    // 4. 清理：组件卸载或 dsl/projectId 切换时销毁旧实例
    return () => { panZoom?.destroy(); };
  }, [dsl, svgId]);

  // 4. 事件代理（非独立 onClick）
  const handleClick = (e: React.MouseEvent) => {
    const node = (e.target as HTMLElement).closest('.node');
    if (node) setActiveNode(node.getAttribute('id')); // → HoverCard
  };

  return <div ref={containerRef} onClick={handleClick} />;
};
```

**依赖**：`mermaid` (npm) → 客户端渲染，`svg-pan-zoom` (npm) → 双指拖拽 + 滚轮缩放 + 控制按钮。

**加载态**：SVG 占位框架 + "正在渲染架构图…"，完成 → Framer Motion `fadeIn` 0.3s。渲染失败 → fallback "架构图暂不可用" + 重试按钮。

### 4.3 FlashCardStack

**职责**：技术难点闪卡，点击翻转查看详解，底部缩略导航条。

**单卡结构**（固定尺寸 400×260px）：
```
┌─────────────────────┐
│  正面                │  ← 问题（≤30 字）
│  如何保证 IM 消息    │
│  的可靠投递？        │
│  [点击翻转 →]        │
└─────────────────────┘
         ↓ rotateY(180deg) — spring: stiffness 260, damping 20
┌─────────────────────┐
│  背面                │  ← 文字区 flex-shrink-0 + 代码区 max-h-[120px]
│  方案：ACK + 重试    │
│  ┌─────────────────┐│
│  │ func send() {   ││  ← bg-slate-950/80, overflow-y-auto
│  │   ...           ││     shiki 语法高亮
│  │ }               ││     [📋 复制] 按钮（右上角绝对定位）
│  └─────────────────┘│
└─────────────────────┘
```

**底部导航条**：3 个小圆点指示器，已翻过的显示 ✓，当前高亮。支持键盘左右箭头切换。

**代码高亮**：`shiki` (ESM, 体积小, VS Code 主题支持)。

**复制按钮**：`navigator.clipboard.writeText(code)`，图标 📋 → ✅ 持续 1.5s。

---

## 五、视觉风格系统

### 5.1 设计 Token

```css
/* packages/ui/src/styles/theme.css */
:root {
  --accent: 217 91% 60%;
  --accent-foreground: 0 0% 100%;
  --accent-soft: 217 91% 97%;

  --background: 40 20% 98%;         /* 微暖黄白底 */
  --foreground: 30 10% 12%;         /* 深暖灰 */
  --muted: 30 6% 55%;
  --muted-foreground: 30 6% 35%;

  --card: 0 0% 100%;
  --card-foreground: 30 10% 12%;
  --card-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
  --card-shadow-hover: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06);

  --radius-sm: 0.375rem;            /* 6px  */
  --radius-md: 0.625rem;            /* 10px */
  --radius-lg: 0.875rem;            /* 14px */
  --radius-xl: 1.25rem;             /* 20px */

  --ease-spring: cubic-bezier(0.22, 0.61, 0.36, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  --glass-bg: rgba(255,255,255,0.72);
  --glass-blur: 12px;
  --glass-border: rgba(0,0,0,0.06);

  --skeleton: 30 10% 90%;           /* 暖卡其灰 */
}
```

### 5.2 共享基础组件

从 shadcn/ui 抽取，统一引用主题 token：

```
packages/ui/src/shared/
├── button.tsx
├── input.tsx
├── textarea.tsx
├── badge.tsx
├── card.tsx
├── dialog.tsx
├── hover-card.tsx
├── skeleton.tsx         # 使用暖色调动画色，非 shadcn/ui 默认冷灰
├── tooltip.tsx
└── icon.tsx
```

---

## 六、文件结构

```
packages/ui/src/
├── anchor/                          # ★ Phase 9 新增
│   ├── jd-input-area.tsx
│   ├── jd-input-area.test.tsx
│   ├── keyword-cloud.tsx
│   ├── keyword-cloud.test.tsx
│   ├── match-radar.tsx
│   └── match-radar.test.tsx
│
├── blueprint/                       # ★ Phase 9 新增
│   ├── project-card-stack.tsx       # 3 列 Grid 容器 + 流式替换
│   ├── project-card.tsx
│   ├── project-card.test.tsx
│   ├── architecture-diagram.tsx     # Mermaid 渲染 + pan-zoom + 事件代理
│   ├── architecture-diagram.test.tsx
│   ├── flash-card-stack.tsx         # 闪卡堆容器 + 键盘导航
│   ├── flash-card.tsx               # 单张翻转闪卡
│   └── flash-card.test.tsx
│
├── shared/                          # shadcn/ui 定制版
│   └── ...
│
├── wizard/                          # Wizard 框架 (已有)
│   ├── wizard-shell.tsx
│   ├── wizard-progress-bar.tsx
│   └── wizard-navigation.tsx
│
├── styles/
│   ├── globals.css
│   └── theme.css                    # 设计 Token
│
└── index.ts

services/fastapi/app/
├── services/
│   └── pipeline.py                  # ★ 升级：接入 shushu-internship-tool CLI
├── routers/
│   └── ws.py
└── schemas/
    └── models.py
```

### 组件依赖图

```
wizard-shell
  ├── jd-input-area          ← anchor/
  │   └── shared/textarea, button
  ├── keyword-cloud          ← anchor/
  │   └── shared/badge
  ├── match-radar            ← anchor/
  │   └── (纯 SVG, 零依赖)
  ├── project-card-stack     ← blueprint/
  │   └── project-card ×3
  │       └── shared/card, badge, skeleton
  ├── architecture-diagram   ← blueprint/
  │   └── mermaid (npm), svg-pan-zoom (npm)
  └── flash-card-stack       ← blueprint/
      └── flash-card ×N
          └── shiki (npm), shared/hover-card
```

---

## 七、测试策略

### 7.1 三层金字塔

```
         ┌─────┐
         │ E2E │  Playwright — 关键用户路径 2 条
         └──┬──┘
       ┌────┴────┐
       │  集成测试 │  Vitest + MSW — Adapter→组件 数据流
       └────┬────┘
    ┌───────┴───────┐
    │   单元测试      │  Vitest + RTL — 每个组件 4 态
    └───────────────┘
```

### 7.2 单元测试矩阵

每个组件覆盖：

| 维度 | 内容 |
|------|------|
| 渲染 | 默认态、Loading 态、Empty 态、Error 态 |
| 交互 | 点击、键盘导航、防抖触发 |
| 边界 | 超长文本截断、空数组、`null` 数据 |

### 7.3 集成测试

验证 Adapter → Zustand Store → 组件渲染 的完整链路，使用 MockAdapter 或 MSW 拦截 WebSocket。

### 7.4 E2E

2 条关键路径：Anchor happy path（粘贴 JD → 看到结果）和 Blueprint happy path（骨架屏 → 卡片到达 → 选中 → 架构图渲染）。

---

## 八、Task 拆分

| # | Task | 内容 | 文件数 | 复杂度 |
|---|------|------|--------|--------|
| **19** | 视觉系统落地 | `theme.css` + shadcn/ui 定制 + 共享组件骨架调整 | 10-12 | 中 |
| **20** | JDInputArea | 输入区 + 字数统计 + Loading 态 + 语音按钮 | 2 | 中 |
| **21** | KeywordCloud + MatchRadar | 莫兰迪标签云 + 打字机动画 + 雷达图 SVG | 4 | 中 |
| **22** | ProjectCard + Stack | 单卡片 + 3 列 Grid + Skeleton 暖色 + 流式替换 | 4 | 大 |
| **23** | ArchitectureDiagram | Mermaid 渲染 + pan-zoom + 事件代理 HoverCard | 2 | 中 |
| **24** | FlashCardStack | 翻转 3D 动画 + shiki 代码高亮 + 滚动控制 | 3 | 中 |
| **25** | 后端 PipelineService | 接入 shushu-internship-tool CLI + LLM 结构化提取 | 2-3 | 大 |
| **26** | Phase 9 集成验证 | 全量 typecheck + test + 双端手动验证 | 0 | 小 |

---

## 九、修正记录

### 修正 1：JD 解析改为一次性返回

**问题**：组件清单写了「流式返回」，数据流写了「一次性返回」，存在冲突。

**修正**：采用一次性 JSON 返回。前端在 `KeywordCloud` 中做打字机动画模拟流式感。IResumeCIAdapter 中 `parseJD` 返回 `Promise<JDParsed>`。

### 修正 2：WizardStore 增加 selectedProjectId

**问题**：卡片点击直接触发架构图/闪卡请求，组件间耦合过紧。切换路由或刷新局部组件时状态丢失。

**修正**：增加 `selectedProjectId: string | null`。`ArchitectureDiagram` 和 `FlashCardStack` 被动监听此 ID，卡片组件只负责写入。

### 修正 3：Blueprint 采用真正的流式 + 骨架屏

**问题**：项目发现（GitHub search → 5 个 repo 逐个 audit）可能长达 20-30s，不能等全部完成再展示。

**修正**：采用真实 SSE 流式传输。前端一进入 Blueprint 立刻显示 3 张 Skeleton，后端每 yield 一个就原地替换一张卡片。第 1 张卡片到达后即可选择。

### 修正 4：Skeleton 暖色化

**问题**：shadcn/ui 默认骨架屏是冷灰色（`bg-muted/10`），在暖黄底上显得「脏」。

**修正**：骨架屏使用 `hsl(30 10% 90%)` 暖卡其灰基底 + `hsl(36 14% 94%)` 脉冲峰。

### 修正 5：标签云莫兰迪色系

**问题**：原计划用纯透明度填充的标签背景色，在暖白底上低对比度易引发视疲劳。

**修正**：采用莫兰迪色系（高明度低饱和背景 + 对应深色文字），所有配对 contrast ≥ 4.5:1，满足 WCAG AA。

### 修正 6：ProjectCard 布局固定 Grid 防抖动

**问题**：流式接收时 Flex/Grid 自适应会导致已到达卡片横向跳动。

**修正**：容器锁定 `grid-template-columns: repeat(3, 1fr)`。Skeleton → Card 用交叉淡入淡出原地替换，Framer Motion `AnimatePresence`，不设 `layout` prop。

### 修正 7：Mermaid 渲染工程化

**问题**：Mermaid 重复渲染会产生 DOM 污染和样式冲突。单个节点 onClick 在 zoom 后失效。

**修正**：每次渲染前清空容器，使用唯一 `svgId` 强制重绘。Pan-zoom 交给 `svg-pan-zoom` 库。节点交互使用事件代理。

### 修正 8：FlashCard 背面溢出控制

**问题**：固定尺寸卡片背面要塞入 150-300 字 + 代码片段，容易溢出。

**修正**：文字区 `flex-shrink-0`，代码区 `max-h-[120px] overflow-y-auto`。代码高亮用 `shiki`，深色背景 + 一键复制按钮。
