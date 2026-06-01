# Resume CI — Phase 10-11 真实 UI 组件设计

> 状态：设计完成，待审阅
> 日期：2026-06-01
> 范围：Step ③ Alignment 证据对齐 + Step ④ Polish 沉浸精修 + Step ⑤ Export 仪式导出 + 收尾

---

## 一、设计决策

延续 Phase 9 的技术路线：
- **混合组件策略**：基础交互 shadcn/ui，特征交互纯手写（Tailwind + Framer Motion）
- **视觉风格**：温暖亲近莫兰迪色系，与 Phase 9 共享 `theme.css`
- **数据驱动**：组件通过 `useAdapter()` + `useWizardStore()` 与后端通信

---

## 二、Step ③ Alignment — 证据对齐

### 2.1 交互模型

AI 逐题提问 → 用户选择/输入答案 → 后端流式返回 STAR Bullet → 证据链实时生长。

```
进入 Alignment
  → adapter.generateAlignmentQuestions(projectId)
    → SSE 流式（一次一道）
  → 用户选择或输入答案
    → adapter.submitAlignmentAnswer(questionId, answer)
      → SSE 流式返回 STARBullet
  → EvidenceChain 实时追加
  → 全部问题答完后自动推进到 Polish（或用户手动跳过）
```

**关键规则**：
- 问题**逐道到达**（不是一次 5 道），前端显示进度 `2/5`
- 每道题用户可跳过 → 该题不生成 STAR 证据
- 用户可在中途随时点「下一步」进入 Polish，未答的题视为放弃
- Cancel 机制：用户回退到 Blueprint 时 cancel 当前 alignment session

### 2.2 WizardStore 扩展

```typescript
// 追加到 WizardState
alignment: {
  questions: AlignmentQuestion[];        // 已收到的问题
  currentQuestionIndex: number;          // 当前题目索引
  evidence: STARBullet[];                // 已生成的 STAR 证据
  status: 'idle' | 'loading' | 'active' | 'done';
};

// 追加 Actions
setCurrentAlignmentQuestion: (q: AlignmentQuestion) => void;
appendAlignmentQuestion: (q: AlignmentQuestion) => void;
appendSTARBullet: (b: STARBullet) => void;
setAlignmentStatus: (s: string) => void;
nextAlignmentQuestion: () => void;
```

### 2.3 QuestionFlow

```
┌──────────────────────────────────────────────────────────────┐
│  问题 2/5                                     STAR 证据链    │
│                                                              │
│  ┌──────────────────────────────────────┐  ┌───────────────┐ │
│  │                                       │  │ S: 在IM系统中 │ │
│  │  [Question 标题，最多两行]             │  │ T: 需保证消息  │ │
│  │                                       │  │ A: 引入ACK确认 │ │
│  │  ○ A: 选项一                          │  │ R: 可靠性99%  │ │
│  │  ● B: 选项二                          │  │               │ │
│  │  ○ C: 选项三                          │  │ [新item从上方  │ │
│  │                                       │  │  滑入生长]    │ │
│  │  或自定义：                            │  └───────────────┘ │
│  │  ┌─────────────────────────────┐      │                    │
│  │  │ 输入你的答案...              │      │  已收集 3 条证据   │
│  │  └─────────────────────────────┘      │                    │
│  │                                       │                    │
│  │  [提交 →]    [跳过此问题]             │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  ◀ 上一题          ● ● ○ ○ ○                 进度 2/5        │
└──────────────────────────────────────────────────────────────┘
```

**状态管理**：
- Loading: 第一道题还未到达时，问题和选项区显示 Skeleton
- Active: 当前问题已展示，等待用户响应
- Submitting: 提交答案后，Submit 按钮变 loading，等待 SSE 返回 STAR
- Done: 所有问题答完，显示 "✓ 证据采集完成" + 自动推进倒计时 3s

**布局**：左右两栏（`grid grid-cols-[1fr_320px] gap-8`），左侧问题区，右侧证据链固定宽度。

### 2.4 OptionGroup

**职责**：渲染选择题选项 + 自定义输入区。

**交互**：
- 单选列表，点击选中，支持键盘 1/2/3 选择
- 选中后高亮（accent 色边框 + 背景），自动聚焦提交按钮
- 「自定义」选项选中时展开内嵌 textarea（`min-h-[3rem] max-h-[8rem]` 自适应）
- 若有预设选项且用户选了预设，直接调 `submitAlignmentAnswer`

**实现要点**：
```tsx
<AnimatePresence>
  {options.map((opt, i) => (
    <motion.button
      key={opt.id}
      animate={{
        backgroundColor: selected === opt.id ? 'hsl(var(--accent-soft))' : 'transparent',
        borderColor: selected === opt.id ? 'hsl(var(--accent))' : 'hsl(var(--muted)/0.3)',
      }}
      onClick={() => setSelected(opt.id)}
    >
      <span className="text-xs font-mono text-[hsl(var(--muted))] mr-3">{String.fromCharCode(65 + i)}</span>
      {opt.text}
    </motion.button>
  ))}
</AnimatePresence>
```

### 2.5 EvidenceChain

**职责**：右侧面板，展示已生成的 STAR 证据列表，新 item 从上方滑入生长。

**实现**：
```tsx
<AnimatePresence>
  {evidence.map((bullet, i) => (
    <motion.div
      key={bullet.id}
      initial={{ opacity: 0, height: 0, y: -20 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <STARBullet data={bullet} index={i + 1} />
    </motion.div>
  ))}
</AnimatePresence>
```

**空态**：答题前显示 "回答第一道题后，STAR 证据将在这里生长 🌱"

### 2.6 STARBullet

**单条 STAR 证据卡片**：
```
┌─────────────────────────┐
│ 证据 #1                  │
│ S 情境：在IM系统开发中    │  ← 蓝色标签
│ T 任务：面临高并发消息场景 │  ← 紫色标签
│ A 行动：引入ACK确认+重试  │  ← 绿色标签
│ R 结果：消息可靠性99.99%  │  ← 橙色标签
└─────────────────────────┘
```

四段分色标签（莫兰迪色系），卡片有微妙阴影，hover 时微微放大。

---

## 三、Step ④ Polish — 沉浸精修（★ 最核心）

### 3.1 交互模型

```
左侧: AI Chat（可折叠）        右侧: WYSIWYG 简历画布
┌─────────────┐              ┌──────────────────────────┐
│ [折叠 ▲]    │              │                          │
│             │              │   姓名                    │
│ AI 对话     │              │   联系方式                │
│ 流式气泡    │              │   ─────────────          │
│             │              │   项目经验               │
│ [输入指令]  │              │   • 高并发IM系统          │
│             │              │     - 选中文字弹出        │
│             │              │       AI操作悬浮条        │
│             │              │                          │
│             │              │      ⏺ 0.98/1页 ✓       │
└─────────────┘              └──────────────────────────┘
```

**核心数据流**：
```
进入 Polish
  → adapter.getResumeHTML()
    → 返回当前简历 HTML 字符串
  → ResumeCanvas 渲染为可编辑 DOM

用户双击段落
  → InlineEditor 激活（contentEditable → textarea）
  → 编辑 → Enter 确认
    → adapter.updateResumeSection(section, newContent)
    → 本地 State 同步更新（乐观更新）

用户划选文字
  → SelectionFloatingBar 弹出
  → 选择操作（Polish/Expand/Shorten）
    → adapter.aiPolish(selectedText, style)
      → SSE 流式返回润色后文本
    → 替换选区内容

后台轮询（每编辑后 2s）
  → adapter.checkPageFit()
    → 更新 PageIndicator
```

### 3.2 ResumeCanvas

**职责**：渲染 HTML 为 WYSIWYG 可编辑简历画布。

**关键设计决策**：
- 使用 `dangerouslySetInnerHTML` 渲染后端返回的 HTML
- 每个可编辑段落包裹 `<div contentEditable="false">`，双击变为 `true`
- 使用 **事件代理** 在容器级别监听 `dblclick`、`keydown`、`selectionchange`
- 画布宽度固定为 A4 比例（794px，基于 96 DPI），高度自适应
- 段落间 Tab 键切换编辑焦点

**安全防护**：
- 所有 HTML 渲染前经过 DOMPurify 清洗
- contentEditable 段落限制只能修改文本，禁止粘贴富文本
- 粘贴事件拦截 → 仅保留纯文本

### 3.3 InlineEditor

**职责**：双击段落后出现的行内编辑体验。

```
普通态：          双击 →          编辑态：
┌───────────────┐              ┌─────────────────────┐
│ 主导设计了    │              │ [textarea: 主导设计  │
│ 高并发IM系统  │              │  了高并发IM系统的   │
│               │              │  整体架构]          │
└───────────────┘              │                     │
                               │ [Enter 确认] [Esc]  │
                               └─────────────────────┘
```

**实现**：
- 编辑区为绝对定位的 `<textarea>`，覆盖在原段落位置上
- 尺寸与原始段落完全一致（通过 `getBoundingClientRect` 动态计算）
- Enter 确认 → blur → 调用 `adapter.updateResumeSection` + 本地 state 同步
- Esc 取消 → 恢复原始文本

### 3.4 SelectionFloatingBar

**职责**：划选文字后浮现 AI 操作悬浮条。

```
划选文字：
┌──────────────────────────────────────┐
│ 主导设计了高并发IM系统的整体架构    │  ← 选择区域高亮
│           ┌──────────────────────┐   │
│           │ ✨ 润色 | 📏 扩写   │   │  ← 悬浮条（绝对定位）
│           │ 📝 精简 | ✏️ 编辑  │   │
│           └──────────────────────┘   │
└──────────────────────────────────────┘
```

**实现要点**：
- 监听 `mouseup` → 获取 `window.getSelection()` → 计算悬浮条位置
- 悬浮条使用 shadcn/ui `Popover` 或纯 Framer Motion `motion.div`
- 位置计算：选区中心偏上方，不超出画布边界
- 点击任一操作 → `adapter.aiPolish(selectedText, style)` → SSE 流式返回 → 替换选区

**4 个操作映射到 `aiPolish` 的 `style` 参数**：
- 润色 → `"polish"`
- 扩写 → `"expand"`
- 精简 → `"shorten"`
- 编辑 → `""`（无 style，用户自定义指令）

### 3.5 PageIndicator

**职责**：右下角固定定位的单页适配状态指示器。

```
⏺ 0.98/1 页 ✓        ← 绿色，完美
● 1.05/1 页 ⚠        ← 黄色，轻微溢出
● 1.20/1 页 ✗        ← 红色，需要调整
```

**实现**：
- `checkPageFit()` 返回 `{ currentPages, status }`
- 圆环 SVG 与 MatchRadar 相同的进度环设计
- `status === 'fit'` → 绿，`'overflow'` → 黄/红
- 动画：每次值更新时数字跳动（Framer Motion `useSpring`）
- 位置：`fixed bottom-6 right-6`，半透明毛玻璃底

### 3.6 AIChat

**职责**：可折叠的 AI 对话面板，流式气泡对话。

```
┌──────────────────────────────┐
│ AI Chat            [折叠 ▲] │
│ ┌──────────────────────────┐ │
│ │ 🤖 建议将「使用了」改为   │ │
│ │ 「主导设计了」...         │ │
│ │ [应用修改] [忽略]         │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ You: 技术栈描述更专业些   │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 输入指令...        [→]   │ │
│ └──────────────────────────┘ │
│                              │
│ 快捷指令：[优化表达] [量化结果] [强化技术关键词]│
└──────────────────────────────┘
```

**实现**：
- 底部 `QuickCommands` 按钮组，点击即填入输入框并自动发送
- SSE 流式返回，气泡逐字打字机效果
- 折叠态：只显示一行小条 "💬 AI Chat"，点击展开
- 展开/折叠动画：Framer Motion `layout` + `height: auto`

---

## 四、Step ⑤ Export — 仪式导出

### 4.1 交互模型

```
用户点击「导出 PDF」
  → adapter.exportPDF()
    → SSE 流式推送 4 个阶段的进度
      Stage 1: 排版对齐 → progress 0-25%
      Stage 2: 字体嵌入 → progress 25-50%
      Stage 3: ATS 校验 → progress 50-75%
      Stage 4: 生成 PDF  → progress 75-100%
    → done 事件携带 PDF 下载 URL
  → PDFPreview 展示缩略图
  → InterviewTip 展示面试锦囊
```

### 4.2 PipelineProgress

**职责**：四阶段流水线进度动画。

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ ①排版对齐│───▶│②字体嵌入│───▶│③ATS校验│───▶│④生成PDF│
│   ✓     │    │  ⏳     │    │  ○     │    │  ○     │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

**实现**：
- 4 个阶段节点 + 连接线，水平排列
- 当前阶段：节点呼吸脉冲 + 连接线动画流动（`background-position` 动画模拟）
- 已完成：绿色勾 + 实心线
- 未开始：灰色空心 + 虚线
- 整体进度条在下方，Framer Motion `width: 0% → 100%`

### 4.3 PDFPreview

**职责**：PDF 内嵌预览。

- 使用 `<iframe src={pdfUrl}>` 或 `<embed>` 展示
- 缩略图模式（`max-h-[500px] overflow-hidden`）+ 点击全屏
- 加载失败 → "PDF 预览暂不可用" + 下载按钮

### 4.4 DownloadButton

**职责**：下载 CTA。
- 主按钮大号 `[⬇ 下载 PDF]`，accent 色，圆角 `radius-xl`
- 次按钮 `[🔄 重新生成]` ghost
- `[📋 复制链接]` → clipboard + toast 提示

### 4.5 InterviewTip

**职责**：面试锦囊彩蛋。

```
┌──────────────────────────────────────────────────────┐
│  💡 面试锦囊                                          │
│                                                      │
│  面试官可能会问你「为什么选择Go而不是Java来做IM系统」， │
│  准备好回答技术选型的理由会让面试更有说服力。           │
│                                                      │
│  你可以这样准备：                                      │
│  • Go 的 goroutine 更适合高并发连接场景                │
│  • 编译型语言部署更轻量                               │
│  • 团队的技术栈偏好                                   │
└──────────────────────────────────────────────────────┘
```

**实现**：毛玻璃卡片，淡入动画延迟 0.5s（等 PDF 先出现），内容由后端 `done.result.interviewTip` 提供。

---

## 五、收尾任务

### 5.1 Schema Codegen 工具链

```
packages/core/schemas/
├── source-of-truth.json        # 唯一 Schema 定义
├── codegen.ts                  # 代码生成脚本
└── generated/
    ├── types.ts                # 自动生成 TypeScript
    └── models.py               # 自动生成 Pydantic
```

**实现**：`codegen.ts` 读取 `source-of-truth.json` → 遍历 `$defs` → 生成 TS interface + Python Pydantic class。通过 `turbo codegen` 调用。

### 5.2 GitHub OAuth 登录

NextAuth.js v5 + GitHub provider，仅 Web 端需要。Desktop 端无认证。

### 5.3 Electron Python 子进程管理

Main process 的 `python-executor.ts`：spawn Python venv → stdio 管道通信 → 生命周期管理（启动/健康检查/退出清理）。

---

## 六、Task 拆分

### Phase 10 Tasks (27-34)

| # | Task | 内容 | 复杂度 |
|---|------|------|--------|
| **27** | WizardStore 扩展 | alignment + polish + export 状态字段 | 小 |
| **28** | QuestionFlow | 问题容器 + 进度条 + SSE 流式接收 | 中 |
| **29** | OptionGroup + STARBullet | 选项列表 + STAR 证据卡片 | 中 |
| **30** | EvidenceChain | 右侧面板 + 列表动画生长 | 小 |
| **31** | ResumeCanvas | HTML 渲染 + contentEditable + DOMPurify | 大 |
| **32** | InlineEditor + SelectionFloatingBar | 行内编辑 + 划选 AI 悬浮条 | 大 |
| **33** | PageIndicator + AIChat | 单页指示器 + AI 对话面板 | 中 |
| **34** | 后端 Alignment + Polish 管线 | generateQuestions + submitAnswer + polish endpoint | 中 |

### Phase 11 Tasks (35-40)

| # | Task | 内容 | 复杂度 |
|---|------|------|--------|
| **35** | PipelineProgress | 四阶段流水线动画 | 小 |
| **36** | PDFPreview + DownloadButton | PDF 预览 + 下载 CTA | 中 |
| **37** | InterviewTip | 面试锦囊彩蛋 | 小 |
| **38** | Schema Codegen | source-of-truth.json → TS + Pydantic | 中 |
| **39** | GitHub OAuth + Middleware | NextAuth.js Web 端登录保护 | 中 |
| **40** | Electron Python Executor | 子进程 spawn + stdio + 生命周期 | 大 |
| **41** | 全量集成验证 | typecheck + test + E2E + 双端手动验证 | 小 |

---

## 七、修正记录

### 修正 1：对齐问题的流式策略

**问题**：5 道题如果一次性返回，前端无法展示逐题推进的体验。

**修正**：`generateAlignmentQuestions` 采用 SSE 流式，一次一道。后端用 `AsyncIterator` yield 单个 `AlignmentQuestion`。

### 修正 2：ResumeCanvas 安全边界

**问题**：`dangerouslySetInnerHTML` + `contentEditable` 是 XSS 高危组合。

**修正**：HTML 渲染前必过 DOMPurify 清洗。contentEditable 拦截粘贴事件仅保留纯文本。

### 修正 3：PageIndicator 解耦自 checkPageFit

**问题**：频繁编辑导致频繁后端调用。

**修正**：编辑后 2s 防抖再调 `checkPageFit()`。用户手动点击指示器可手动触发刷新。
