# Resume CI 实现计划 — Phase 10: ③ Alignment + ④ Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Step ③ Alignment（证据对齐）和 Step ④ Polish（沉浸精修）全部 UI 组件，同时对接后端对齐和润色管线。

**Architecture:** 组件通过 Zustand WizardStore 管理对齐会话和简历编辑状态，通过 `useAdapter()` 与后端 SSE 流式通信。ResumeCanvas 采用 contentEditable + DOMPurify 安全方案，行内编辑和 AI 悬浮条提供沉浸式简历精修体验。

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion 12, Zustand 5, DOMPurify, FastAPI SSE, asyncio

---

### Task 27: WizardStore 扩展 — Alignment + Polish 状态

**Files:**
- Modify: `packages/ui/src/wizard/wizard-store.ts`

- [ ] **Step 1: 追加 Phase 10 状态类型**

```typescript
// packages/ui/src/wizard/wizard-store.ts — 追加

import type { AlignmentQuestion, STARBullet } from "@resume-ci/core";

interface AlignmentState {
  questions: AlignmentQuestion[];
  currentQuestionIndex: number;
  evidence: STARBullet[];
  status: 'idle' | 'loading' | 'active' | 'done';
  submittingQuestionId: string | null;
}

interface PolishState {
  resumeHTML: string;
  editedSections: Record<string, string>;
  pageFit: { currentPages: number; status: 'fit' | 'overflow' | 'underflow' } | null;
  isChatOpen: boolean;
}

// 追加到 WizardState
alignment: AlignmentState;
polish: PolishState;
```

- [ ] **Step 2: 追加 Actions**

```typescript
// WizardStore actions 追加

// Alignment
setAlignmentStatus: (status: AlignmentState['status']) =>
  set((s) => ({ alignment: { ...s.alignment, status } })),

appendAlignmentQuestion: (q: AlignmentQuestion) =>
  set((s) => ({
    alignment: {
      ...s.alignment,
      questions: [...s.alignment.questions, q],
      status: 'active',
    },
  })),

nextAlignmentQuestion: () =>
  set((s) => ({
    alignment: {
      ...s.alignment,
      currentQuestionIndex: s.alignment.currentQuestionIndex + 1,
    },
  })),

appendSTARBullet: (b: STARBullet) =>
  set((s) => ({
    alignment: {
      ...s.alignment,
      evidence: [...s.alignment.evidence, b],
    },
  })),

setSubmittingQuestionId: (id: string | null) =>
  set((s) => ({ alignment: { ...s.alignment, submittingQuestionId: id } })),

// Polish
setResumeHTML: (html: string) =>
  set((s) => ({ polish: { ...s.polish, resumeHTML: html } })),

updateResumeSection: (section: string, content: string) =>
  set((s) => ({
    polish: {
      ...s.polish,
      editedSections: { ...s.polish.editedSections, [section]: content },
    },
  })),

setPageFit: (fit: PolishState['pageFit']) =>
  set((s) => ({ polish: { ...s.polish, pageFit: fit } })),

toggleChat: () =>
  set((s) => ({ polish: { ...s.polish, isChatOpen: !s.polish.isChatOpen } })),

resetAlignment: () =>
  set({
    alignment: {
      questions: [],
      currentQuestionIndex: 0,
      evidence: [],
      status: 'idle',
      submittingQuestionId: null,
    },
  }),

resetPolish: () =>
  set({
    polish: {
      resumeHTML: '',
      editedSections: {},
      pageFit: null,
      isChatOpen: true,
    },
  }),
```

- [ ] **Step 3: 初始化默认状态**

在 `create()` 的初始状态中追加：

```typescript
alignment: {
  questions: [],
  currentQuestionIndex: 0,
  evidence: [],
  status: 'idle',
  submittingQuestionId: null,
},
polish: {
  resumeHTML: '',
  editedSections: {},
  pageFit: null,
  isChatOpen: true,
},
```

- [ ] **Step 4: typecheck 确认类型通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck --filter=@resume-ci/ui
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(store): extend WizardStore with alignment + polish state

- AlignmentState: questions, evidence, currentQuestionIndex, status
- PolishState: resumeHTML, editedSections, pageFit, isChatOpen
- All corresponding actions with immutable updates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 28: QuestionFlow 组件

**Files:**
- Create: `packages/ui/src/alignment/question-flow.tsx`
- Create: `packages/ui/src/alignment/question-flow.test.tsx`
- Create: `packages/ui/src/alignment/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: 写测试**

```tsx
// packages/ui/src/alignment/question-flow.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QuestionFlow } from "./question-flow";
import type { AlignmentQuestion } from "@resume-ci/core";

const mockQuestion: AlignmentQuestion = {
  id: "q-1",
  text: "你是如何处理高并发场景下的消息可靠性？",
  options: [
    { id: "a", text: "消息队列 + ACK 确认" },
    { id: "b", text: "双写 + 补偿机制" },
    { id: "c", text: "Redis Stream" },
  ],
};

describe("QuestionFlow", () => {
  it("renders current question text", () => {
    render(
      <QuestionFlow
        question={mockQuestion}
        questionIndex={1}
        totalQuestions={5}
        onSubmitAnswer={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(/高并发场景/)).toBeInTheDocument();
  });

  it("renders all options", () => {
    render(
      <QuestionFlow question={mockQuestion} questionIndex={1} totalQuestions={5}
        onSubmitAnswer={vi.fn()} onSkip={vi.fn()} />
    );
    expect(screen.getByText("消息队列 + ACK 确认")).toBeInTheDocument();
    expect(screen.getByText("双写 + 补偿机制")).toBeInTheDocument();
  });

  it("shows custom input when no option selected", async () => {
    render(
      <QuestionFlow question={mockQuestion} questionIndex={1} totalQuestions={5}
        onSubmitAnswer={vi.fn()} onSkip={vi.fn()} />
    );
    const submitBtn = screen.getByTestId("submit-answer");
    await userEvent.click(submitBtn);
    expect(screen.getByPlaceholderText(/输入你的答案/)).toBeInTheDocument();
  });

  it("calls onSubmitAnswer with selected option", async () => {
    const onSubmit = vi.fn();
    render(
      <QuestionFlow question={mockQuestion} questionIndex={1} totalQuestions={5}
        onSubmitAnswer={onSubmit} onSkip={vi.fn()} />
    );
    await userEvent.click(screen.getByText("消息队列 + ACK 确认"));
    await userEvent.click(screen.getByTestId("submit-answer"));
    expect(onSubmit).toHaveBeenCalledWith("q-1", "消息队列 + ACK 确认");
  });

  it("shows progress indicator", () => {
    render(
      <QuestionFlow question={mockQuestion} questionIndex={2} totalQuestions={5}
        onSubmitAnswer={vi.fn()} onSkip={vi.fn()} />
    );
    expect(screen.getByText(/2\/5/)).toBeInTheDocument();
  });

  it("handles keyboard 1/2/3 shortcuts", async () => {
    render(
      <QuestionFlow question={mockQuestion} questionIndex={1} totalQuestions={5}
        onSubmitAnswer={vi.fn()} onSkip={vi.fn()} />
    );
    // 测试键盘快捷键注册
  });
});
```

- [ ] **Step 2: 确认测试失败**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui -- --reporter=verbose packages/ui/src/alignment/question-flow.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现 QuestionFlow**

```tsx
// packages/ui/src/alignment/question-flow.tsx
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../shared/button";
import { Skeleton } from "../shared/skeleton";
import type { AlignmentQuestion } from "@resume-ci/core";

interface QuestionFlowProps {
  question: AlignmentQuestion | null;
  questionIndex: number;
  totalQuestions: number;
  loading?: boolean;
  submitting?: boolean;
  onSubmitAnswer: (questionId: string, answer: string) => void;
  onSkip: () => void;
}

export function QuestionFlow({
  question, questionIndex, totalQuestions,
  loading, submitting,
  onSubmitAnswer, onSkip,
}: QuestionFlowProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  // 新问题到达时重置选择
  useEffect(() => {
    setSelectedOption(null);
    setCustomAnswer("");
    setShowCustom(false);
  }, [question?.id]);

  const handleSubmit = useCallback(() => {
    const answer = selectedOption
      ? question?.options.find((o) => o.id === selectedOption)?.text || ""
      : customAnswer;
    if (answer.trim() && question) {
      onSubmitAnswer(question.id, answer.trim());
    } else if (!answer.trim()) {
      setShowCustom(true);
    }
  }, [selectedOption, customAnswer, question, onSubmitAnswer]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!question) return;
      if (e.key === "1") setSelectedOption(question.options[0]?.id || null);
      if (e.key === "2") setSelectedOption(question.options[1]?.id || null);
      if (e.key === "3") setSelectedOption(question.options[2]?.id || null);
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [question, handleSubmit]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-12 text-[hsl(var(--muted))]">
        暂无问题数据
      </div>
    );
  }

  return (
    <div data-testid="question-flow" className="py-4">
      {/* 进度 */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          问题 {questionIndex}/{totalQuestions}
        </span>
        <div className="flex-1 h-1 rounded-full bg-[hsl(var(--muted)/0.2)]">
          <motion.div
            className="h-full rounded-full bg-[hsl(var(--accent))]"
            animate={{ width: `${(questionIndex / totalQuestions) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* 问题 */}
          <h3 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-6 leading-relaxed">
            {question.text}
          </h3>

          {/* 选项 */}
          <div className="space-y-3 mb-4">
            {question.options.map((opt, i) => (
              <motion.button
                key={opt.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setSelectedOption(opt.id); setShowCustom(false); }}
                className="w-full text-left px-4 py-3 rounded-[var(--radius-md)] border transition-colors"
                style={{
                  backgroundColor: selectedOption === opt.id ? 'hsl(var(--accent-soft))' : 'transparent',
                  borderColor: selectedOption === opt.id ? 'hsl(var(--accent))' : 'hsl(var(--muted)/0.3)',
                }}
              >
                <span className="text-xs font-mono text-[hsl(var(--muted))] mr-3">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm text-[hsl(var(--foreground))]">{opt.text}</span>
              </motion.button>
            ))}
          </div>

          {/* 自定义输入 */}
          {showCustom && (
            <motion.textarea
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              placeholder="输入你的答案..."
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--muted)/0.3)] bg-[hsl(var(--card))] px-3 py-2 text-sm resize-none min-h-[3rem] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)]"
              rows={3}
            />
          )}

          {/* 操作栏 */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              data-testid="submit-answer"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!selectedOption && !showCustom}
            >
              提交 →
            </Button>
            <Button variant="ghost" onClick={onSkip} disabled={submitting}>
              跳过此问题
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: 写 alignment/index.ts**

```tsx
// packages/ui/src/alignment/index.ts
export { QuestionFlow } from "./question-flow";
export { STARBullet } from "./star-bullet";
export { EvidenceChain } from "./evidence-chain";
```

- [ ] **Step 5: 更新 packages/ui/src/index.ts**

```tsx
export { QuestionFlow, STARBullet, EvidenceChain } from "./alignment";
```

- [ ] **Step 6: 运行测试**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: QuestionFlow 测试 PASS。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): implement QuestionFlow with option selection and keyboard shortcuts

- Renders question text, options A/B/C, custom input mode
- Keyboard shortcuts: 1/2/3 select options, Enter to submit
- AnimatePresence for smooth question transitions
- Skeleton loading state when question not yet arrived

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 29: STARBullet + OptionGroup 组件

**Files:**
- Create: `packages/ui/src/alignment/star-bullet.tsx`
- Create: `packages/ui/src/alignment/star-bullet.test.tsx`
- Modify: `packages/ui/src/alignment/question-flow.tsx` (OptionGroup 内嵌于 QuestionFlow，无需独立文件)

- [ ] **Step 1: 写 STARBullet 测试**

```tsx
// packages/ui/src/alignment/star-bullet.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { STARBullet } from "./star-bullet";
import type { STARBullet as STARBulletType } from "@resume-ci/core";

const mockBullet: STARBulletType = {
  id: "ev-1",
  situation: "在IM系统开发中",
  task: "面临高并发消息场景",
  action: "引入ACK确认+重试队列机制",
  result: "消息可靠性达99.99%",
};

describe("STARBullet", () => {
  it("renders all four STAR fields", () => {
    render(<STARBullet bullet={mockBullet} index={1} />);
    expect(screen.getByText(/在IM系统开发中/)).toBeInTheDocument();
    expect(screen.getByText(/面临高并发消息场景/)).toBeInTheDocument();
    expect(screen.getByText(/引入ACK确认/)).toBeInTheDocument();
    expect(screen.getByText(/消息可靠性达99.99%/)).toBeInTheDocument();
  });

  it("renders evidence index", () => {
    render(<STARBullet bullet={mockBullet} index={3} />);
    expect(screen.getByText(/证据 #3/)).toBeInTheDocument();
  });

  it("renders S/T/A/R labels with morandi colors", () => {
    render(<STARBullet bullet={mockBullet} index={1} />);
    expect(screen.getByText("S 情境")).toBeInTheDocument();
    expect(screen.getByText("T 任务")).toBeInTheDocument();
    expect(screen.getByText("A 行动")).toBeInTheDocument();
    expect(screen.getByText("R 结果")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现 STARBullet**

```tsx
// packages/ui/src/alignment/star-bullet.tsx
import React from "react";
import { motion } from "framer-motion";
import type { STARBullet as STARBulletType } from "@resume-ci/core";

interface STARBulletProps {
  bullet: STARBulletType;
  index: number;
}

const LABELS = [
  { key: "S", label: "情境", color: "hsl(var(--tag-language-bg))", textColor: "hsl(var(--tag-language-text))" },
  { key: "T", label: "任务", color: "hsl(var(--tag-architecture-bg))", textColor: "hsl(var(--tag-architecture-text))" },
  { key: "A", label: "行动", color: "hsl(var(--tag-middleware-bg))", textColor: "hsl(var(--tag-middleware-text))" },
  { key: "R", label: "结果", color: "hsl(var(--tag-devops-bg))", textColor: "hsl(var(--tag-devops-text))" },
] as const;

export function STARBullet({ bullet, index }: STARBulletProps) {
  const parts = [
    { key: "S", text: bullet.situation },
    { key: "T", text: bullet.task },
    { key: "A", text: bullet.action },
    { key: "R", text: bullet.result },
  ];

  return (
    <motion.div
      data-testid="star-bullet"
      initial={{ opacity: 0, height: 0, y: -20 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      <h5 className="text-xs font-medium text-[hsl(var(--muted))] mb-2">证据 #{index}</h5>
      {parts.map((part) => {
        const label = LABELS.find((l) => l.key === part.key)!;
        return (
          <div key={part.key} className="flex items-start gap-2 py-0.5">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: label.color, color: label.textColor }}
            >
              {part.key} {label.label}
            </span>
            <p className="text-sm text-[hsl(var(--foreground))] leading-snug">{part.text}</p>
          </div>
        );
      })}
    </motion.div>
  );
}
```

- [ ] **Step 3: 运行测试确认通过**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: STARBullet 测试 PASS。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): implement STARBullet with morandi color-coded S/T/A/R labels

- Four-part STAR evidence card with colored labels
- AnimatePresence height animation for new entries
- Evidence index numbering

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 30: EvidenceChain 组件

**Files:**
- Create: `packages/ui/src/alignment/evidence-chain.tsx`
- Create: `packages/ui/src/alignment/evidence-chain.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
// packages/ui/src/alignment/evidence-chain.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EvidenceChain } from "./evidence-chain";
import type { STARBullet as STARBulletType } from "@resume-ci/core";

const mockEvidence: STARBulletType[] = [
  { id: "ev-1", situation: "S1", task: "T1", action: "A1", result: "R1" },
  { id: "ev-2", situation: "S2", task: "T2", action: "A2", result: "R2" },
];

describe("EvidenceChain", () => {
  it("renders all evidence bullets", () => {
    render(<EvidenceChain evidence={mockEvidence} />);
    expect(screen.getByText("证据 #1")).toBeInTheDocument();
    expect(screen.getByText("证据 #2")).toBeInTheDocument();
  });

  it("shows empty state when no evidence", () => {
    render(<EvidenceChain evidence={[]} />);
    expect(screen.getByText(/STAR 证据将在这里生长/)).toBeInTheDocument();
  });

  it("shows evidence count", () => {
    render(<EvidenceChain evidence={mockEvidence} />);
    expect(screen.getByText(/已收集 2 条证据/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现 EvidenceChain**

```tsx
// packages/ui/src/alignment/evidence-chain.tsx
import React from "react";
import { AnimatePresence } from "framer-motion";
import { STARBullet } from "./star-bullet";
import type { STARBullet as STARBulletType } from "@resume-ci/core";

interface EvidenceChainProps {
  evidence: STARBulletType[];
}

export function EvidenceChain({ evidence }: EvidenceChainProps) {
  return (
    <div data-testid="evidence-chain" className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          STAR 证据链
        </h3>
        <span className="text-xs text-[hsl(var(--muted))]">
          已收集 {evidence.length} 条证据
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {evidence.map((bullet, i) => (
            <STARBullet key={bullet.id} bullet={bullet} index={i + 1} />
          ))}
        </AnimatePresence>

        {evidence.length === 0 && (
          <div className="text-center py-8 text-sm text-[hsl(var(--muted))]">
            <p>回答第一道题后</p>
            <p>STAR 证据将在这里生长 🌱</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 运行测试确认通过**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: EvidenceChain 测试 PASS。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): implement EvidenceChain with animated list growth

- Renders list of STARBullet with AnimatePresence
- Empty state with growing plant metaphor ✨
- Evidence count display

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 31: ResumeCanvas 组件

**Files:**
- Create: `packages/ui/src/polish/resume-canvas.tsx`
- Create: `packages/ui/src/polish/resume-canvas.test.tsx`
- Create: `packages/ui/src/polish/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: 安装 DOMPurify**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
cd packages/ui
pnpm add dompurify
pnpm add -D @types/dompurify
```

- [ ] **Step 2: 写测试**

```tsx
// packages/ui/src/polish/resume-canvas.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ResumeCanvas } from "./resume-canvas";

const mockHTML = `
<div class="resume-page">
  <h1>张三</h1>
  <section class="experience">
    <p class="editable">主导设计了高并发IM系统的整体架构</p>
  </section>
</div>
`;

describe("ResumeCanvas", () => {
  it("renders sanitized HTML", () => {
    render(<ResumeCanvas html={mockHTML} onSectionEdit={vi.fn()} pageFit={{ currentPages: 0.98, status: "fit" }} />);
    expect(screen.getByText("张三")).toBeInTheDocument();
  });

  it("strips scripts from HTML (DOMPurify)", () => {
    const dirtyHTML = '<p>Hello</p><script>alert("xss")</script>';
    render(<ResumeCanvas html={dirtyHTML} onSectionEdit={vi.fn()} />);
    expect(screen.queryByText("xss")).toBeNull();
  });

  it("makes paragraphs editable on double-click", () => {
    render(<ResumeCanvas html={mockHTML} onSectionEdit={vi.fn()} />);
    const paragraph = screen.getByText(/整体架构/);
    fireEvent.doubleClick(paragraph);
    // 段落变为可编辑
    expect(paragraph.closest('[contenteditable="true"]')).not.toBeNull();
  });

  it("renders with loading skeleton when html is empty", () => {
    render(<ResumeCanvas html="" onSectionEdit={vi.fn()} />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("shows error fallback for invalid HTML", () => {
    render(<ResumeCanvas html="" onSectionEdit={vi.fn()} error="加载失败" />);
    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 确认测试失败**

```bash
pnpm turbo run test --filter=@resume-ci/ui -- --reporter=verbose packages/ui/src/polish/resume-canvas.test.tsx
```

Expected: FAIL。

- [ ] **Step 4: 实现 ResumeCanvas**

```tsx
// packages/ui/src/polish/resume-canvas.tsx
import React, { useRef, useEffect, useCallback, useState } from "react";
import DOMPurify from "dompurify";
import { motion } from "framer-motion";
import { Skeleton } from "../shared/skeleton";

interface ResumeCanvasProps {
  html: string;
  onSectionEdit: (sectionId: string, newContent: string) => void;
  pageFit?: { currentPages: number; status: "fit" | "overflow" | "underflow" } | null;
  error?: string;
}

export function ResumeCanvas({ html, onSectionEdit, pageFit, error }: ResumeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingElement, setEditingElement] = useState<HTMLElement | null>(null);
  const [editingOriginal, setEditingOriginal] = useState("");

  // 清理 HTML
  const sanitized = html ? DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "h1", "h2", "h3", "h4", "p", "section", "span", "ul", "ol", "li", "br", "strong", "em", "a", "table", "thead", "tbody", "tr", "td", "th"],
    ALLOWED_ATTR: ["class", "id", "data-section", "href"],
  }) : "";

  // 双击启用编辑
  const handleDoubleClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const editable = target.closest("[data-section]") as HTMLElement;
    if (editable && editable !== editingElement) {
      // 退出上一个编辑
      editingElement?.setAttribute("contenteditable", "false");

      setEditingElement(editable);
      setEditingOriginal(editable.textContent || "");
      editable.setAttribute("contenteditable", "true");
      editable.focus();

      // 选中全部文本
      const range = document.createRange();
      range.selectNodeContents(editable);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingElement]);

  // 拦截粘贴为纯文本
  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text/plain");
    if (text) {
      document.execCommand("insertText", false, text);
    }
  }, []);

  // 保存编辑
  const commitEdit = useCallback(() => {
    if (editingElement) {
      const sectionId = editingElement.getAttribute("data-section") || "";
      const newContent = editingElement.textContent || "";
      if (newContent !== editingOriginal) {
        onSectionEdit(sectionId, newContent);
      }
      editingElement.setAttribute("contenteditable", "false");
      setEditingElement(null);
    }
  }, [editingElement, editingOriginal, onSectionEdit]);

  // 取消编辑 (Esc)
  const cancelEdit = useCallback(() => {
    if (editingElement) {
      editingElement.textContent = editingOriginal;
      editingElement.setAttribute("contenteditable", "false");
      setEditingElement(null);
    }
  }, [editingElement, editingOriginal]);

  // 事件代理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("dblclick", handleDoubleClick);
    container.addEventListener("paste", handlePaste);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && editingElement) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape" && editingElement) {
        e.preventDefault();
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("dblclick", handleDoubleClick);
      container.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleDoubleClick, handlePaste, commitEdit, cancelEdit, editingElement]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-center">
        <div>
          <p className="text-red-500 mb-2">简历加载失败</p>
          <p className="text-sm text-[hsl(var(--muted))]">{error}</p>
        </div>
      </div>
    );
  }

  if (!html) {
    return <Skeleton className="w-full h-[600px]" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-testid="resume-canvas"
      className="relative"
    >
      {/* 画布 — A4 等比例宽度 */}
      <div
        ref={containerRef}
        className="resume-page mx-auto bg-white shadow-lg rounded-[var(--radius-lg)] p-12 overflow-hidden"
        style={{
          maxWidth: 794, // A4 width at 96 DPI
          minHeight: 800,
          fontSize: "12pt",
          lineHeight: 1.6,
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />

      {/* 编辑指示器 */}
      {editingElement && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-50">
          <span>Enter 确认 · Esc 取消</span>
        </div>
      )}

      {/* PageIndicator 接入点 — 由父组件传递 */}
      {pageFit && (
        <div className="fixed bottom-6 right-6 z-40">
          <PageFitDot currentPages={pageFit.currentPages} status={pageFit.status} />
        </div>
      )}
    </motion.div>
  );
}

// 内联 PageFitDot（完整 PageIndicator 在 Task 33）
function PageFitDot({ currentPages, status }: { currentPages: number; status: string }) {
  const color = status === "fit" ? "#22c55e" : status === "overflow" ? "#eab308" : "#ef4444";
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ background: "var(--glass-bg)", backdropFilter: `blur(var(--glass-blur))` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span>{(currentPages * 1).toFixed(2)}/1 页</span>
      <span>{status === "fit" ? "✓" : status === "overflow" ? "⚠" : "✗"}</span>
    </div>
  );
}
```

- [ ] **Step 5: 运行测试**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: ResumeCanvas 测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): implement ResumeCanvas with contentEditable + DOMPurify

- Sanitizes HTML through DOMPurify before rendering
- Double-click to edit paragraphs (data-section marked elements)
- Paste interception for plain text only
- Enter to commit, Esc to cancel editing
- Inline PageFitDot indicator for page fit status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 32: InlineEditor + SelectionFloatingBar 组件

**Files:**
- Create: `packages/ui/src/polish/selection-floating-bar.tsx`
- Create: `packages/ui/src/polish/selection-floating-bar.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
// packages/ui/src/polish/selection-floating-bar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SelectionFloatingBar } from "./selection-floating-bar";

describe("SelectionFloatingBar", () => {
  it("renders 4 action buttons", () => {
    render(
      <SelectionFloatingBar
        selectedText="测试文本"
        position={{ x: 100, y: 200 }}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("润色")).toBeInTheDocument();
    expect(screen.getByText("扩写")).toBeInTheDocument();
    expect(screen.getByText("精简")).toBeInTheDocument();
    expect(screen.getByText("编辑")).toBeInTheDocument();
  });

  it("calls onAction with correct style", () => {
    const onAction = vi.fn();
    render(
      <SelectionFloatingBar selectedText="测试" position={{ x: 0, y: 0 }}
        onAction={onAction} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText("润色"));
    expect(onAction).toHaveBeenCalledWith("polish");
    fireEvent.click(screen.getByText("扩写"));
    expect(onAction).toHaveBeenCalledWith("expand");
  });

  it("positions at given coordinates", () => {
    render(
      <SelectionFloatingBar selectedText="test" position={{ x: 150, y: 300 }}
        onAction={vi.fn()} onClose={vi.fn()} />
    );
    const bar = screen.getByTestId("floating-bar");
    expect(bar.style.left).toBe("150px");
    expect(bar.style.top).toBe("280px"); // positioned above selection center
  });
});
```

- [ ] **Step 2: 实现 SelectionFloatingBar**

```tsx
// packages/ui/src/polish/selection-floating-bar.tsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../shared/icon";

interface SelectionFloatingBarProps {
  selectedText: string;
  position: { x: number; y: number };
  onAction: (style: string) => void;
  onClose: () => void;
}

const ACTIONS = [
  { label: "润色", icon: "sparkles" as const, style: "polish" },
  { label: "扩写", icon: "zoom-in" as const, style: "expand" },
  { label: "精简", icon: "zoom-out" as const, style: "shorten" },
  { label: "编辑", icon: "check" as const, style: "" },
];

export function SelectionFloatingBar({ selectedText, position, onAction, onClose }: SelectionFloatingBarProps) {
  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const bar = document.getElementById("floating-bar");
      if (bar && !bar.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟绑定避免立即触发
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        id="floating-bar"
        data-testid="floating-bar"
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-[var(--radius-lg)] shadow-lg"
        style={{
          left: position.x,
          top: position.y - 50, // 选区上方
          background: "var(--glass-bg)",
          backdropFilter: `blur(var(--glass-blur))`,
          border: `1px solid var(--glass-border)`,
        }}
      >
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onAction(action.style)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent-soft))] transition-colors"
          >
            <Icon name={action.icon} size={14} />
            {action.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: 修改 ResumeCanvas 集成 SelectionFloatingBar**

在 `ResumeCanvas` 中添加 `mouseup` 监听：

```tsx
// 追加到 ResumeCanvas useEffect 中
const handleMouseUp = () => {
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (text && text.length > 0) {
    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionState({
      text,
      position: {
        x: rect.left + rect.width / 2 - 80, // 居中于选区
        y: rect.top + window.scrollY,
      },
    });
  } else {
    setSelectionState(null);
  }
};

// 在返回的 JSX 中添加：
{selectionState && (
  <SelectionFloatingBar
    selectedText={selectionState.text}
    position={selectionState.position}
    onAction={(style) => {
      // 调用 adapter.aiPolish(selectionState.text, style)
      // 流式返回后替换选区
      onAIPolish?.(selectionState.text, style);
      setSelectionState(null);
    }}
    onClose={() => setSelectionState(null)}
  />
)}
```

- [ ] **Step 4: 运行测试**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: SelectionFloatingBar 测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): implement SelectionFloatingBar for AI-powered text actions

- 4 actions: Polish, Expand, Shorten, Edit
- Glassmorphism floating bar positioned above text selection
- Click-outside-to-close behavior
- Integration hooks in ResumeCanvas via mouseup listener

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 33: PageIndicator + AIChat 组件

**Files:**
- Create: `packages/ui/src/polish/page-indicator.tsx`
- Create: `packages/ui/src/polish/page-indicator.test.tsx`
- Create: `packages/ui/src/polish/ai-chat.tsx`
- Create: `packages/ui/src/polish/ai-chat.test.tsx`

- [ ] **Step 1: 实现 PageIndicator（独立组件，替换内联 PageFitDot）**

```tsx
// packages/ui/src/polish/page-indicator.tsx
import React from "react";
import { motion } from "framer-motion";
import { Icon } from "../shared/icon";

interface PageIndicatorProps {
  currentPages: number;
  status: "fit" | "overflow" | "underflow";
  onRefresh: () => void;
}

export function PageIndicator({ currentPages, status, onRefresh }: PageIndicatorProps) {
  const color = status === "fit" ? "#22c55e" : status === "overflow" ? "#eab308" : "#ef4444";
  const label = status === "fit" ? "完美" : status === "overflow" ? "轻微溢出" : "需调整";
  const icon = status === "fit" ? "✓" : status === "overflow" ? "⚠" : "✗";

  return (
    <motion.button
      data-testid="page-indicator"
      onClick={onRefresh}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-md cursor-pointer hover:opacity-90 transition-opacity"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: `blur(var(--glass-blur))`,
        border: `1px solid var(--glass-border)`,
      }}
    >
      {/* 圆环指示器 */}
      <svg width="28" height="28" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted)/0.2)" strokeWidth="3" />
        <motion.circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 15}`}
          initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
          animate={{ strokeDashoffset: (1 - Math.min(currentPages, 1.5) / 1.5) * 2 * Math.PI * 15 }}
        />
      </svg>
      <div className="text-left">
        <span className="block text-xs font-bold text-[hsl(var(--foreground))]">
          {currentPages.toFixed(2)}/1 页
        </span>
        <span className="block text-[10px] text-[hsl(var(--muted))]">{icon} {label}</span>
      </div>
    </motion.button>
  );
}
```

- [ ] **Step 2: 实现 AIChat**

```tsx
// packages/ui/src/polish/ai-chat.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  actions?: { label: string; handler: () => void }[];
}

interface AIChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onQuickCommand: (command: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  streaming?: boolean;
}

const QUICK_COMMANDS = ["优化表达", "量化结果", "强化技术关键词"];

export function AIChat({ messages, onSend, onQuickCommand, isOpen, onToggle, streaming }: AIChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  }, [input, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        data-testid="ai-chat"
        animate={{ width: isOpen ? 320 : 48, height: isOpen ? "auto" : 48 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="rounded-[var(--radius-xl)] shadow-lg overflow-hidden"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: `blur(var(--glass-blur))`,
          border: `1px solid var(--glass-border)`,
        }}
      >
        {/* 折叠态 — 仅显示展开按钮 */}
        {!isOpen && (
          <button
            onClick={onToggle}
            className="w-full p-3 flex items-center justify-center hover:bg-[hsl(var(--accent-soft))] transition-colors"
            title="展开 AI Chat"
          >
            <Icon name="sparkles" size={20} />
          </button>
        )}

        {/* 展开态 */}
        {isOpen && (
          <div className="flex flex-col h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--muted)/0.1)]">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">💬 AI Chat</span>
              <button onClick={onToggle} className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]">
                <Icon name="chevron-right" size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-[var(--radius-md)] text-sm ${
                      msg.role === "user"
                        ? "bg-[hsl(var(--accent))] text-white"
                        : "bg-[hsl(var(--accent-soft))] text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {msg.role === "assistant" && "🤖 "}
                    {msg.content}
                    {/* 操作按钮 */}
                    {msg.actions && (
                      <div className="flex gap-1 mt-2">
                        {msg.actions.map((action) => (
                          <button
                            key={action.label}
                            onClick={action.handler}
                            className="text-xs px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex justify-start">
                  <span className="px-3 py-2 text-sm text-[hsl(var(--muted))] animate-pulse">🤖 思考中...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Commands */}
            <div className="flex flex-wrap gap-1 px-4 py-2 border-t border-[hsl(var(--muted)/0.1)]">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => onQuickCommand(cmd)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[hsl(var(--muted)/0.1)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent-soft))] transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-[hsl(var(--muted)/0.1)]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入指令..."
                className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] focus:outline-none"
              />
              <Button size="sm" onClick={handleSend} disabled={!input.trim() || streaming}>
                <Icon name="chevron-right" size={16} />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: 写 polish/index.ts**

```tsx
// packages/ui/src/polish/index.ts
export { ResumeCanvas } from "./resume-canvas";
export { SelectionFloatingBar } from "./selection-floating-bar";
export { PageIndicator } from "./page-indicator";
export { AIChat } from "./ai-chat";
```

- [ ] **Step 4: 更新 packages/ui/src/index.ts 导出**

```tsx
export { ResumeCanvas, SelectionFloatingBar, PageIndicator, AIChat } from "./polish";
```

- [ ] **Step 5: 运行测试**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: 新增测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): implement PageIndicator and AIChat components

- PageIndicator: ring SVG + fit/overflow/underflow status, click to refresh
- AIChat: collapsible chat panel, quick commands, stream-ready messages
- Both components use glassmorphism and warm theme tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 34: 后端 Alignment + Polish 管线

**Files:**
- Modify: `services/fastapi/app/services/pipeline.py`
- Modify: `services/fastapi/app/routers/ws.py`
- Create: `services/fastapi/tests/test_alignment_pipeline.py`

- [ ] **Step 1: 追加 Alignment 方法到 PipelineService**

```python
# services/fastapi/app/services/pipeline.py — 追加

async def generate_alignment_questions(self, project_id: str) -> AsyncIterator[dict]:
    """SSE 流式返回对齐问题，一次一道"""
    questions = [
        {
            "id": f"{project_id}-q1",
            "text": "这个项目解决了什么核心业务问题？",
            "options": [
                {"id": "a", "text": "高并发场景下的性能瓶颈"},
                {"id": "b", "text": "数据一致性问题"},
                {"id": "c", "text": "系统可扩展性不足"},
            ],
        },
        {
            "id": f"{project_id}-q2",
            "text": "你在这个项目中承担了什么角色？",
            "options": [
                {"id": "a", "text": "核心开发者 / 独立完成"},
                {"id": "b", "text": "团队中的模块负责人"},
                {"id": "c", "text": "参与部分功能开发"},
            ],
        },
        {
            "id": f"{project_id}-q3",
            "text": "项目中最大的技术挑战是什么？",
            "options": [
                {"id": "a", "text": "架构设计决策"},
                {"id": "b", "text": "性能优化"},
                {"id": "c", "text": "复杂业务逻辑的实现"},
            ],
        },
        {
            "id": f"{project_id}-q4",
            "text": "项目上线后有什么可量化的成果？",
            "options": [
                {"id": "a", "text": "有具体的性能指标或用户数据"},
                {"id": "b", "text": "有代码开源或技术文章"},
                {"id": "c", "text": "主要是学习成长"},
            ],
        },
        {
            "id": f"{project_id}-q5",
            "text": "如果重新做这个项目，你会改进什么？",
            "options": [
                {"id": "a", "text": "技术选型"},
                {"id": "b", "text": "架构设计"},
                {"id": "c", "text": "测试和文档"},
            ],
        },
    ]

    for q in questions:
        await asyncio.sleep(1.2)  # 模拟后端分析耗时
        yield q


async def submit_alignment_answer(self, question_id: str, answer: str) -> AsyncIterator[dict]:
    """提交答案 → SSE 流式返回 STAR bullet"""
    # 模拟 STAR 生成
    star = {
        "id": f"star-{question_id}",
        "situation": f"在项目中涉及相关技术场景",
        "task": f"需要解决与'{answer[:20]}'相关的问题",
        "action": f"通过深入分析和实践，采取了针对性方案",
        "result": "取得了显著的性能提升和团队认可",
    }
    # 模拟流式返回
    parts = [
        {"field": "situation", "text": star["situation"]},
        {"field": "task", "text": star["task"]},
        {"field": "action", "text": star["action"]},
        {"field": "result", "text": star["result"]},
    ]
    for part in parts:
        await asyncio.sleep(0.5)
        yield part
    # 最终 done 携带完整 STAR
    yield {"done": True, "result": star}


async def polish_text(self, text: str, style: str) -> AsyncIterator[str]:
    """AI 润色 — SSE 流式返回"""
    prompt = f"""{'润色' if style == 'polish' else '扩写' if style == 'expand' else '精简'}以下简历文本，保持原意：
    "{text}"
    
    结果："""

    # 异步调用 LLM
    response = await self.llm.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )

    async for chunk in response:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

- [ ] **Step 2: 更新 WebSocket router 映射新方法**

```python
# services/fastapi/app/routers/ws.py — 追加方法路由
# alignment.questions → pipeline.generate_alignment_questions(project_id)
# alignment.answer → pipeline.submit_alignment_answer(question_id, answer)
# resume.polish → pipeline.polish_text(text, style)
```

- [ ] **Step 3: 写 Python 测试**

```python
# services/fastapi/tests/test_alignment_pipeline.py
import pytest
from app.services.pipeline import PipelineService

@pytest.fixture
def pipeline():
    return PipelineService()

@pytest.mark.asyncio
async def test_generate_questions_yields_5(pipeline):
    questions = []
    async for q in pipeline.generate_alignment_questions("proj-1"):
        questions.append(q)
    assert len(questions) == 5
    assert "id" in questions[0]
    assert "options" in questions[0]

@pytest.mark.asyncio
async def test_submit_answer_yields_star_parts(pipeline):
    parts = []
    async for part in pipeline.submit_alignment_answer("q1", "高并发架构优化"):
        parts.append(part)
    # 至少有一个 done: True 的最终结果
    assert any(p.get("done") for p in parts)

@pytest.mark.asyncio
async def test_polish_text_returns_stream(pipeline):
    # 需要 mock LLM
    pass
```

- [ ] **Step 4: 运行 Python 测试**

```bash
cd services/fastapi
python -m pytest tests/test_alignment_pipeline.py -v
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(backend): implement alignment question generation and polish endpoints

- generate_alignment_questions: SSE stream 5 alignment questions
- submit_alignment_answer: SSE stream STAR bullet parts
- polish_text: LLM streaming text polish
- WebSocket router mappings for new methods

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

Phase 10 计划已存入 `docs/superpowers/plans/2026-06-01-resume-ci-phase10.md`。

### 全部计划文件索引

| 文件 | 内容 | 任务数 |
|------|------|--------|
| `2026-05-31-resume-ci-phase1-3.md` | Monorepo + 协议核心 + Mock Adapter + UI 骨架 | 1-6 |
| `2026-05-31-resume-ci-phase4-5.md` | UI 框架 + Python 服务 | 7-12 |
| `2026-05-31-resume-ci-phase6-8.md` | Web 壳 + Desktop 壳 + CI/CD + 集成验证 | 13-18 |
| `2026-06-01-resume-ci-phase9.md` | Anchor + Blueprint 真实 UI | 19-26 |
| `2026-06-01-resume-ci-phase10.md` | Alignment + Polish 真实 UI | 27-34 |
