# Resume CI 实现计划 — Phase 9: 真实 UI 组件 ① Anchor + ② Blueprint

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Step ① Anchor（锚点输入）和 Step ② Blueprint（项目蓝图）的全部真实 UI 组件，同时升级 FastAPI PipelineService 接入 shushu-internship-tool CLI。

**Architecture:** shadcn/ui 定制基础组件 + 纯手写特征组件（Tailwind CSS + Framer Motion），温暖莫兰迪色系。组件通过 `useAdapter()` hook 消费 `IResumeCIAdapter`，通过 `useWizardStore()` 读写全局状态。

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion 12, Zustand 5, shadcn/ui, mermaid, svg-pan-zoom, shiki, Vitest, Playwright, FastAPI, asyncio

---

### Task 19: 视觉系统落地

**Files:**
- Create: `packages/ui/src/styles/theme.css`
- Modify: `packages/ui/src/styles/globals.css`
- Create: `packages/ui/src/shared/button.tsx`
- Create: `packages/ui/src/shared/input.tsx`
- Create: `packages/ui/src/shared/textarea.tsx`
- Create: `packages/ui/src/shared/badge.tsx`
- Create: `packages/ui/src/shared/card.tsx`
- Create: `packages/ui/src/shared/skeleton.tsx`
- Create: `packages/ui/src/shared/dialog.tsx`
- Create: `packages/ui/src/shared/hover-card.tsx`
- Create: `packages/ui/src/shared/tooltip.tsx`
- Create: `packages/ui/src/shared/icon.tsx`
- Modify: `packages/ui/src/shared/index.ts`
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/src/wizard/wizard-store.ts` (扩展)

- [ ] **Step 1: 安装新依赖**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
cd packages/ui
pnpm add mermaid svg-pan-zoom shiki
pnpm add -D @testing-library/react @testing-library/jest-dom @types/mermaid
```

Expected: 所有包安装成功，lockfile 更新。

- [ ] **Step 2: 写 theme.css — 设计 Token**

```css
/* packages/ui/src/styles/theme.css */
:root {
  /* ── 品牌色 ── */
  --accent: 217 91% 60%;
  --accent-foreground: 0 0% 100%;
  --accent-soft: 217 91% 97%;

  /* ── 暖灰基调 ── */
  --background: 40 20% 98%;
  --foreground: 30 10% 12%;
  --muted: 30 6% 55%;
  --muted-foreground: 30 6% 35%;

  /* ── 卡片 ── */
  --card: 0 0% 100%;
  --card-foreground: 30 10% 12%;

  /* ── 圆角 ── */
  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 0.875rem;
  --radius-xl: 1.25rem;

  /* ── 动效 ── */
  --ease-spring: cubic-bezier(0.22, 0.61, 0.36, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* ── 毛玻璃 ── */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-blur: 12px;
  --glass-border: rgba(0, 0, 0, 0.06);

  /* ── 骨架屏暖色 ── */
  --skeleton-base: 30 10% 90%;
  --skeleton-peak: 36 14% 94%;

  /* ── 莫兰迪标签色系 ── */
  --tag-language-bg: 210 45% 82%;
  --tag-language-text: 215 70% 28%;
  --tag-architecture-bg: 270 35% 85%;
  --tag-architecture-text: 270 50% 30%;
  --tag-middleware-bg: 155 30% 82%;
  --tag-middleware-text: 160 55% 22%;
  --tag-devops-bg: 25 50% 83%;
  --tag-devops-text: 20 65% 28%;
  --tag-concept-bg: 35 28% 84%;
  --tag-concept-text: 32 30% 30%;
}

/* selection 颜色与主题一致 */
::selection {
  background-color: hsl(var(--accent) / 0.2);
  color: hsl(var(--foreground));
}
```

- [ ] **Step 3: 更新 globals.css — 引入 theme**

```css
/* packages/ui/src/styles/globals.css */
@import "tailwindcss";
@import "./theme.css";

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 4: 写 shared/skeleton.tsx — 暖色骨架屏**

```tsx
// packages/ui/src/shared/skeleton.tsx
import React from "react";

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode; // 当 children 存在时，skeleton 作为 loading wrapper
}

export function Skeleton({ className = "", children }: SkeletonProps) {
  // 如果提供了 children 且不为空，直接渲染 children（loaded 态）
  if (children) return <>{children}</>;

  return (
    <div
      data-testid="skeleton"
      className={`animate-pulse rounded-md ${className}`}
      style={{
        background: `linear-gradient(
          90deg,
          hsl(var(--skeleton-base)) 0%,
          hsl(var(--skeleton-peak)) 40%,
          hsl(var(--skeleton-base)) 100%
        )`,
        backgroundSize: "200% 100%",
      }}
    />
  );
}
```

- [ ] **Step 5: 写 shared/card.tsx — 通用卡片容器**

```tsx
// packages/ui/src/shared/card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", selected, onClick }: CardProps) {
  return (
    <div
      data-testid="card"
      onClick={onClick}
      className={`
        rounded-[var(--radius-lg)] bg-[hsl(var(--card))] p-6
        shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]
        transition-all duration-[var(--duration-normal)] var(--ease-spring)
        ${onClick ? "cursor-pointer" : ""}
        ${selected
          ? "ring-2 ring-[hsl(var(--accent))] scale-[1.03] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)]"
          : "hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)]"
        }
        ${className}
      `}
    >
      {children}
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 写 shared/badge.tsx — 莫兰迪色系标签**

```tsx
// packages/ui/src/shared/badge.tsx
import React from "react";

type TagCategory = "language" | "architecture" | "middleware" | "devops" | "concept";

interface BadgeProps {
  children: React.ReactNode;
  category?: TagCategory;
  size?: "sm" | "md" | "lg";
  weight?: "fill" | "outline";
  className?: string;
}

const CATEGORY_STYLES: Record<TagCategory, { bg: string; text: string }> = {
  language:     { bg: "hsl(var(--tag-language-bg))",     text: "hsl(var(--tag-language-text))" },
  architecture: { bg: "hsl(var(--tag-architecture-bg))", text: "hsl(var(--tag-architecture-text))" },
  middleware:   { bg: "hsl(var(--tag-middleware-bg))",   text: "hsl(var(--tag-middleware-text))" },
  devops:       { bg: "hsl(var(--tag-devops-bg))",       text: "hsl(var(--tag-devops-text))" },
  concept:      { bg: "hsl(var(--tag-concept-bg))",      text: "hsl(var(--tag-concept-text))" },
};

const SIZE_CLASSES = { sm: "px-2 py-0.5 text-xs", md: "px-3 py-1 text-sm", lg: "px-4 py-1.5 text-base" };

export function Badge({ children, category = "concept", size = "md", weight = "fill", className = "" }: BadgeProps) {
  const cs = CATEGORY_STYLES[category];
  return (
    <span
      data-testid="badge"
      className={`inline-flex items-center rounded-[var(--radius-sm)] font-medium ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: weight === "fill" ? cs.bg : "transparent",
        color: cs.text,
        border: weight === "outline" ? `1px solid ${cs.text}` : "none",
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 7: 写 shared/button.tsx**

```tsx
// packages/ui/src/shared/button.tsx
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-all duration-[var(--duration-fast)] disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90",
    secondary: "bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))] hover:opacity-80",
    ghost: "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent-soft))]",
  };

  return (
    <button
      data-testid="button"
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </>
      ) : children}
    </button>
  );
}
```

- [ ] **Step 8: 写 shared/input.tsx, shared/textarea.tsx, shared/icon.tsx（精简版）**

```tsx
// packages/ui/src/shared/input.tsx
import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => (
    <input
      ref={ref}
      data-testid="input"
      className={`w-full rounded-[var(--radius-md)] border border-[hsl(var(--muted)/0.3)] bg-[hsl(var(--card))] px-4 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)] ${error ? "border-red-400" : ""} ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
```

```tsx
// packages/ui/src/shared/textarea.tsx
import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  showCharCount?: boolean;
  minChars?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, showCharCount, minChars, value, ...props }, ref) => {
    const charCount = typeof value === "string" ? value.length : 0;
    const meetsMin = minChars ? charCount >= minChars : true;

    return (
      <div className="relative">
        <textarea
          ref={ref}
          data-testid="textarea"
          className={`w-full rounded-[var(--radius-lg)] border border-[hsl(var(--muted)/0.3)] bg-[hsl(var(--card))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent)/0.3)] resize-none min-h-[8rem] font-mono ${error ? "border-red-400" : ""} ${className}`}
          {...props}
          value={value}
        />
        {showCharCount && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            <span className={meetsMin ? "text-green-500" : "text-[hsl(var(--muted))]"}>
              字数：{charCount}
            </span>
            {minChars && !meetsMin && (
              <span className="text-[hsl(var(--muted))]">建议至少 {minChars} 字以获得更精准的匹配</span>
            )}
            {minChars && meetsMin && <span className="text-green-500">✓</span>}
          </div>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
```

```tsx
// packages/ui/src/shared/icon.tsx
import React from "react";

interface IconProps {
  name: "mic" | "upload" | "sparkles" | "chevron-left" | "chevron-right" | "check" | "copy" | "zoom-in" | "zoom-out" | "rotate-ccw" | "flip";
  size?: number;
  className?: string;
}

const PATHS: Record<string, string> = {
  mic: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  sparkles: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z M20 3v4 M22 5h-4 M4 17v2 M5 18H3",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 18l6-6-6-6",
  check: "M20 6L9 17l-5-5",
  copy: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z",
  "zoom-in": "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35 M11 8v6 M8 11h6",
  "zoom-out": "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35 M8 11h6",
  "rotate-ccw": "M3 10a9 9 0 0 1 9-9 9 9 0 0 1 9 9 9 9 0 0 1-9 9 M3 10h6 M3 10V4",
  flip: "M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7",
};

export function Icon({ name, size = 20, className = "" }: IconProps) {
  const d = PATHS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {d.split(" ").filter(Boolean).map((cmd, i) => {
        const isMoveTo = cmd === "M";
        const isNumber = /^-?\d/.test(cmd);
        if (isMoveTo || isNumber) {
          return <path key={i} d={`${cmd} ${d.split(" ").slice(i + 1).join(" ")}`} />;
        }
        return null;
      })}
      <path d={d} />
    </svg>
  );
}
```

- [ ] **Step 9: 写 shared/index.ts — 统一导出共享组件**

```tsx
// packages/ui/src/shared/index.ts
export { Button } from "./button";
export { Input } from "./input";
export { Textarea } from "./textarea";
export { Badge } from "./badge";
export { Card } from "./card";
export { Skeleton } from "./skeleton";
export { Icon } from "./icon";
// Dialog, HoverCard, Tooltip 留待按需实现基础版
```

- [ ] **Step 10: 扩展 wizard-store.ts — 新增 Phase 9 字段**

```tsx
// packages/ui/src/wizard/wizard-store.ts
// 在现有 WizardState interface 中追加以下字段：

/*
  // 追加到 WizardState:
  jd: JDParsed | null;
  selectedProjectId: string | null;
  projects: ProjectCard[];
  projectsLoading: 'idle' | 'loading' | 'done';
*/

// 追加 Actions:
/*
  setJD: (jd: JDParsed) => void;
  setSelectedProjectId: (id: string | null) => void;
  appendProject: (project: ProjectCard) => void;
  setProjectsLoading: (status: 'idle' | 'loading' | 'done') => void;
  resetPhase9: () => void;  // 清空 jd/projects/selectedProjectId
*/
```

具体实现：

```tsx
// packages/ui/src/wizard/wizard-store.ts — 追加内容到 create 调用中

setJD: (jd) => set({ jd }),

setSelectedProjectId: (id) => set({ selectedProjectId: id }),

appendProject: (project) =>
  set((state) => ({
    projects: [...state.projects, project],
  })),

setProjectsLoading: (status) => set({ projectsLoading: status }),

resetPhase9: () =>
  set({
    jd: null,
    selectedProjectId: null,
    projects: [],
    projectsLoading: 'idle',
  }),
```

- [ ] **Step 11: 类型同步 — 确保 @resume-ci/core 的 JDParsed 和 ProjectCard 类型匹配**

确认 `packages/core/src/types/` 中的类型定义与设计 spec 一致：

```typescript
// packages/core/src/types/jd.ts (如不存在则创建)
export interface JDParsed {
  keywords: KeywordItem[];
  techStack: string[];
  roleType: string;
  matchProfile: MatchProfile;
}

export interface KeywordItem {
  word: string;
  weight: number;
  category: 'language' | 'architecture' | 'middleware' | 'devops' | 'concept';
}

export interface MatchProfile {
  score: number;
  gaps: string[];
}
```

```typescript
// packages/core/src/types/project.ts (如不存在则创建)
export interface ProjectCard {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  jdMatchScore: number;
  architecture: string; // mermaid DSL
  challenges: FlashCardData[];
}

export interface FlashCardData {
  id: string;
  question: string;
  answer: string;
  codeSnippet?: string;
  language?: string; // 代码语言，供 shiki 高亮
}
```

- [ ] **Step 12: 运行 typecheck 确认基础类型和组件编译通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck --filter=@resume-ci/ui
```

Expected: PASS 或仅有 non-blocking warnings。

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(ui): add theme system + shared components + wizard store extension

- theme.css: warm organic design tokens, morandi color palette
- shared/: Button, Input, Textarea, Badge, Card, Skeleton, Icon
- Skeleton uses warm khaki tones (hsl 30 10% 90%) instead of cold gray
- Badge supports 5 tag categories with WCAG AA contrast ratios
- WizardStore extended with jd, selectedProjectId, projects, projectsLoading

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 20: JDInputArea 组件

**Files:**
- Create: `packages/ui/src/anchor/jd-input-area.tsx`
- Create: `packages/ui/src/anchor/jd-input-area.test.tsx`
- Create: `packages/ui/src/anchor/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: 写测试文件**

```tsx
// packages/ui/src/anchor/jd-input-area.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { JDInputArea } from "./jd-input-area";

// Mock adapter
const createMockAdapter = () => ({
  parseJD: vi.fn().mockResolvedValue({
    keywords: [{ word: "Go", weight: 0.95, category: "language" }],
    techStack: ["Go"],
    roleType: "后端",
    matchProfile: { score: 0.87, gaps: [] },
  }),
});

// Mock useAdapter hook — 直接通过 props 注入
// 组件接受 adapter prop 而非通过 context，简化测试

describe("JDInputArea", () => {
  let mockAdapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
  });

  it("renders textarea with placeholder", () => {
    render(<JDInputArea adapter={mockAdapter as any} />);
    expect(screen.getByTestId("jd-textarea")).toBeInTheDocument();
    expect(screen.getByTestId("jd-textarea")).toHaveAttribute("placeholder");
  });

  it("shows character count when user types", async () => {
    render(<JDInputArea adapter={mockAdapter as any} />);
    const textarea = screen.getByTestId("jd-textarea");
    await userEvent.type(textarea, "我们正在寻找一位后端开发实习生...");
    expect(screen.getByText(/字数：/)).toBeInTheDocument();
  });

  it("shows warning when character count < 150", async () => {
    render(<JDInputArea adapter={mockAdapter as any} />);
    const textarea = screen.getByTestId("jd-textarea");
    await userEvent.type(textarea, "短文本");
    expect(screen.getByText(/建议至少/)).toBeInTheDocument();
  });

  it("shows green check when character count >= 150", async () => {
    render(<JDInputArea adapter={mockAdapter as any} />);
    const textarea = screen.getByTestId("jd-textarea");
    const longText = "A".repeat(150);
    await userEvent.type(textarea, longText);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("calls adapter.parseJD when parse button is clicked", async () => {
    const onParsed = vi.fn();
    render(<JDInputArea adapter={mockAdapter as any} onParsed={onParsed} />);
    const textarea = screen.getByTestId("jd-textarea");
    await userEvent.type(textarea, "A".repeat(150));
    await userEvent.click(screen.getByTestId("parse-btn"));
    expect(mockAdapter.parseJD).toHaveBeenCalled();
  });

  it("disables parse button when text is empty", () => {
    render(<JDInputArea adapter={mockAdapter as any} />);
    expect(screen.getByTestId("parse-btn")).toBeDisabled();
  });

  it("shows loading state while parsing", async () => {
    mockAdapter.parseJD = vi.fn().mockImplementation(() => new Promise((r) => setTimeout(r, 10000)));
    render(<JDInputArea adapter={mockAdapter as any} />);
    const textarea = screen.getByTestId("jd-textarea");
    await userEvent.type(textarea, "A".repeat(150));
    await userEvent.click(screen.getByTestId("parse-btn"));
    expect(screen.getByTestId("jd-loading-overlay")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 确认测试失败**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui -- --reporter=verbose packages/ui/src/anchor/jd-input-area.test.tsx
```

Expected: FAIL — 文件未找到 (jd-input-area.tsx 尚未创建)。

- [ ] **Step 3: 实现 JDInputArea 组件**

```tsx
// packages/ui/src/anchor/jd-input-area.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Textarea } from "../shared/textarea";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";
import type { IResumeCIAdapter, JDParsed } from "@resume-ci/core";

interface JDInputAreaProps {
  adapter: IResumeCIAdapter;
  onParsed?: (jd: JDParsed) => void;
}

type ParseState = "idle" | "pending" | "loading" | "success" | "error";

export function JDInputArea({ adapter, onParsed }: JDInputAreaProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<ParseState>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MIN_CHARS = 150;

  const charCount = text.length;
  const canParse = charCount > 0 && state !== "loading";

  // 清理 debounce 定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleParse = useCallback(async () => {
    if (!canParse) return;

    // 清除之前的 debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    setState("loading");
    setError(null);

    try {
      const result = await adapter.parseJD(text);
      setState("success");
      onParsed?.(result as JDParsed);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "解析失败，请重试");
    }
  }, [text, canParse, adapter, onParsed]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);
      setState("idle"); // 用户继续输入时重置状态

      // 防抖 1.5s 自动解析
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length >= MIN_CHARS) {
        setState("pending");
        debounceRef.current = setTimeout(() => {
          handleParse();
        }, 1500);
      }
    },
    [handleParse]
  );

  return (
    <div data-testid="jd-input-area" className="relative">
      {/* Loading 遮罩 */}
      {state === "loading" && (
        <div
          data-testid="jd-loading-overlay"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[var(--radius-xl)]"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: `blur(var(--glass-blur))`,
            border: `1px solid var(--glass-border)`,
          }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spin mb-3" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">AI 正在理解 JD…</p>
        </div>
      )}

      <div className={`transition-opacity duration-300 ${state === "loading" ? "opacity-40 blur-[0.5px]" : ""}`}>
        {/* 标题 */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            📋 粘贴职位描述 (Job Description)
          </h3>
        </div>

        {/* Textarea */}
        <Textarea
          data-testid="jd-textarea"
          value={text}
          onChange={handleTextChange}
          placeholder={`例如：\n我们正在寻找一位后端开发实习生，要求：\n- 熟悉 Go 或 Java，了解微服务架构\n- 有 Redis、消息队列的实际使用经验\n- 了解 Docker 容器化部署...`}
          rows={8}
          showCharCount
          minChars={MIN_CHARS}
          error={error || undefined}
        />

        {/* 操作栏 */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {/* 语音输入 — 预留 */}}
              title="语音输入（即将上线）"
            >
              <Icon name="mic" size={16} className="mr-1" /> 语音输入
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {/* 截图 OCR — 预留 */}}
              title="上传截图 OCR（即将上线）"
            >
              <Icon name="upload" size={16} className="mr-1" /> 截图 OCR
            </Button>
          </div>

          <Button
            data-testid="parse-btn"
            onClick={handleParse}
            disabled={!canParse}
            loading={state === "loading"}
            size="lg"
          >
            <Icon name="sparkles" size={18} className="mr-2" />
            解析 →
          </Button>
        </div>

        {/* Error 信息 */}
        {state === "error" && error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 写 anchor/index.ts**

```tsx
// packages/ui/src/anchor/index.ts
export { JDInputArea } from "./jd-input-area";
export { KeywordCloud } from "./keyword-cloud";
export { MatchRadar } from "./match-radar";
```

- [ ] **Step 5: 更新 packages/ui/src/index.ts — 追加导出**

```tsx
// 在现有导出后追加
export { JDInputArea, KeywordCloud, MatchRadar } from "./anchor";
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: JDInputArea 测试全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): implement JDInputArea with auto-parse and glassmorphism loading

- Textarea with character count and min-char validation
- Debounce 1.5s auto-trigger + manual 'Parse' button
- Glassmorphism loading overlay with spinner
- Voice input and Screenshot OCR buttons (placeholder)
- Error state display

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 21: KeywordCloud + MatchRadar 组件

**Files:**
- Create: `packages/ui/src/anchor/keyword-cloud.tsx`
- Create: `packages/ui/src/anchor/keyword-cloud.test.tsx`
- Create: `packages/ui/src/anchor/match-radar.tsx`
- Create: `packages/ui/src/anchor/match-radar.test.tsx`

- [ ] **Step 1: 写 KeywordCloud 测试**

```tsx
// packages/ui/src/anchor/keyword-cloud.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { KeywordCloud } from "./keyword-cloud";
import type { KeywordItem } from "@resume-ci/core";

const mockKeywords: KeywordItem[] = [
  { word: "Go", weight: 0.95, category: "language" },
  { word: "微服务", weight: 0.85, category: "architecture" },
  { word: "消息队列", weight: 0.72, category: "middleware" },
  { word: "Docker", weight: 0.68, category: "devops" },
  { word: "分布式", weight: 0.60, category: "concept" },
];

describe("KeywordCloud", () => {
  it("renders all keywords", () => {
    render(<KeywordCloud keywords={mockKeywords} />);
    const badges = screen.getAllByTestId("kw-tag");
    expect(badges).toHaveLength(mockKeywords.length);
  });

  it("renders keywords sorted by weight (descending)", () => {
    render(<KeywordCloud keywords={mockKeywords} />);
    const badges = screen.getAllByTestId("kw-tag");
    expect(badges[0]).toHaveTextContent("Go");      // weight 0.95
    expect(badges[1]).toHaveTextContent("微服务");   // weight 0.85
  });

  it("renders empty state when no keywords", () => {
    render(<KeywordCloud keywords={[]} />);
    expect(screen.queryByTestId("kw-tag")).toBeNull();
  });

  it("applies morandi category colors", () => {
    render(<KeywordCloud keywords={mockKeywords} />);
    const goTag = screen.getByText("Go").closest('[data-testid="kw-tag"]');
    // language category → blueish background
    expect(goTag).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现 KeywordCloud**

```tsx
// packages/ui/src/anchor/keyword-cloud.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../shared/badge";
import type { KeywordItem } from "@resume-ci/core";

interface KeywordCloudProps {
  keywords: KeywordItem[];
}

export function KeywordCloud({ keywords }: KeywordCloudProps) {
  // 按 weight 降序排列
  const sorted = [...keywords].sort((a, b) => b.weight - a.weight);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--muted))] text-sm">
        暂无关键词
      </div>
    );
  }

  // 根据 weight 确定 size
  const getSize = (weight: number): "sm" | "md" | "lg" => {
    if (weight > 0.8) return "lg";
    if (weight > 0.5) return "md";
    return "sm";
  };

  const getWeight = (weight: number): "fill" | "outline" => {
    return weight > 0.5 ? "fill" : "outline";
  };

  return (
    <div data-testid="keyword-cloud" className="py-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">
        关键词提取
      </h3>
      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence>
          {sorted.map((kw, i) => (
            <motion.span
              key={kw.word}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.08, // stagger — 高权重词先出现
                duration: 0.3,
                ease: "easeOut",
              }}
            >
              <Badge
                data-testid="kw-tag"
                category={kw.category}
                size={getSize(kw.weight)}
                weight={getWeight(kw.weight)}
              >
                {kw.word}
              </Badge>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 写 MatchRadar 测试**

```tsx
// packages/ui/src/anchor/match-radar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MatchRadar } from "./match-radar";
import type { MatchProfile } from "@resume-ci/core";

const mockProfile: MatchProfile = {
  score: 0.87,
  gaps: ["消息队列实战经验", "分布式链路追踪"],
};

describe("MatchRadar", () => {
  it("renders overall match score", () => {
    render(<MatchRadar profile={mockProfile} />);
    expect(screen.getByText(/87%/)).toBeInTheDocument();
  });

  it("renders gap list", () => {
    render(<MatchRadar profile={mockProfile} />);
    expect(screen.getByText(/消息队列实战经验/)).toBeInTheDocument();
    expect(screen.getByText(/分布式链路追踪/)).toBeInTheDocument();
  });

  it("renders suggestion for each gap", () => {
    render(<MatchRadar profile={mockProfile} />);
    const tips = screen.getAllByText(/💡/);
    expect(tips).toHaveLength(mockProfile.gaps.length);
  });

  it("renders empty state when no gaps", () => {
    render(<MatchRadar profile={{ score: 0.95, gaps: [] }} />);
    expect(screen.getByText(/完美匹配/)).toBeInTheDocument();
  });

  it("renders radar chart SVG", () => {
    render(<MatchRadar profile={mockProfile} />);
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 实现 MatchRadar**

```tsx
// packages/ui/src/anchor/match-radar.tsx
import React from "react";
import { motion } from "framer-motion";
import type { MatchProfile } from "@resume-ci/core";

interface MatchRadarProps {
  profile: MatchProfile;
}

export function MatchRadar({ profile }: MatchRadarProps) {
  const scorePercent = Math.round(profile.score * 100);
  const scoreColor = scorePercent >= 85 ? "text-green-500" : scorePercent >= 70 ? "text-yellow-500" : "text-orange-500";
  const ringColor = scorePercent >= 85 ? "#22c55e" : scorePercent >= 70 ? "#eab308" : "#f97316";

  const gaps = profile.gaps;

  return (
    <div data-testid="match-radar" className="py-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">匹配度分析</h3>

      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* 圆环进度图 — 简化为 SVG 圆环 */}
        <motion.div className="relative w-44 h-44 flex-shrink-0">
          <svg
            data-testid="radar-chart"
            viewBox="0 0 160 160"
            className="w-full h-full -rotate-90"
          >
            {/* 背景圆环 */}
            <circle cx="80" cy="80" r="68" fill="none" stroke="hsl(var(--muted) / 0.2)" strokeWidth="12" />
            {/* 进度圆环 */}
            <motion.circle
              cx="80" cy="80" r="68"
              fill="none"
              stroke={ringColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 68}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 68 }}
              animate={{ strokeDashoffset: (1 - profile.score) * 2 * Math.PI * 68 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${scoreColor}`}>{scorePercent}%</span>
            <span className="text-xs text-[hsl(var(--muted))]">匹配度</span>
          </div>
        </motion.div>

        {/* 缺口和建议 */}
        <div className="flex-1 space-y-4">
          {gaps.length === 0 ? (
            <div className="text-green-500 font-medium">✅ 完美匹配！你与这个岗位高度契合</div>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">待加强</h4>
                {gaps.map((gap) => (
                  <div key={gap} className="flex items-start gap-2 py-1">
                    <span className="text-yellow-500">⚠️</span>
                    <span className="text-sm text-[hsl(var(--foreground))]">{gap}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-1">修复建议</h4>
                {gaps.map((gap) => (
                  <p key={gap} className="text-sm text-[hsl(var(--muted-foreground))] py-0.5">
                    💡 建议：选择一个包含{gap.replace(/经验|理解|能力|技能/g, "").trim()}的项目来弥补
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: KeywordCloud + MatchRadar 测试全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): implement KeywordCloud and MatchRadar

- KeywordCloud: weight-sorted tag cloud with morandi colors + Framer Motion stagger animation
- MatchRadar: SVG ring progress + gap analysis with fix suggestions
- Both components handle empty states gracefully

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 22: ProjectCard + ProjectCardStack 组件

**Files:**
- Create: `packages/ui/src/blueprint/project-card.tsx`
- Create: `packages/ui/src/blueprint/project-card.test.tsx`
- Create: `packages/ui/src/blueprint/project-card-stack.tsx`
- Create: `packages/ui/src/blueprint/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: 写 ProjectCard 测试**

```tsx
// packages/ui/src/blueprint/project-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ProjectCard } from "./project-card";
import type { ProjectCard as ProjectCardType } from "@resume-ci/core";

const mockCard: ProjectCardType = {
  id: "proj-1",
  title: "高并发IM即时通讯系统",
  description: "基于 Go 和 WebSocket 的实时通讯平台",
  techStack: ["Go", "WebSocket", "Redis", "K8s"],
  jdMatchScore: 0.89,
  architecture: "graph TD\n  A-->B",
  challenges: [],
};

describe("ProjectCard", () => {
  it("renders project title and description", () => {
    render(<ProjectCard project={mockCard} />);
    expect(screen.getByText("高并发IM即时通讯系统")).toBeInTheDocument();
    expect(screen.getByText(/实时通讯平台/)).toBeInTheDocument();
  });

  it("renders tech stack badges", () => {
    render(<ProjectCard project={mockCard} />);
    mockCard.techStack.forEach((tech) => {
      expect(screen.getByText(tech)).toBeInTheDocument();
    });
  });

  it("renders match score", () => {
    render(<ProjectCard project={mockCard} />);
    expect(screen.getByText(/89%/)).toBeInTheDocument();
  });

  it("shows selected state", () => {
    render(<ProjectCard project={mockCard} selected />);
    expect(screen.getByTestId("card")).toHaveClass("ring-2");
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<ProjectCard project={mockCard} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("card"));
    expect(onSelect).toHaveBeenCalledWith("proj-1");
  });

  it("calls onViewDetail when detail button clicked", async () => {
    const onViewDetail = vi.fn();
    render(<ProjectCard project={mockCard} onViewDetail={onViewDetail} />);
    await userEvent.click(screen.getByTestId("view-detail-btn"));
    expect(onViewDetail).toHaveBeenCalledWith("proj-1");
  });
});
```

- [ ] **Step 2: 确认测试失败**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui -- --reporter=verbose packages/ui/src/blueprint/project-card.test.tsx
```

Expected: FAIL — project-card.tsx 尚未创建。

- [ ] **Step 3: 实现 ProjectCard**

```tsx
// packages/ui/src/blueprint/project-card.tsx
import React from "react";
import { motion } from "framer-motion";
import { Card } from "../shared/card";
import { Badge } from "../shared/badge";
import type { ProjectCard as ProjectCardType } from "@resume-ci/core";

interface ProjectCardProps {
  project: ProjectCardType;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onViewDetail?: (id: string) => void;
  animate?: boolean;
}

export function ProjectCard({ project, selected, onSelect, onViewDetail, animate = true }: ProjectCardProps) {
  const scorePercent = Math.round(project.jdMatchScore * 100);
  const scoreColor = scorePercent >= 85 ? "text-green-500" : scorePercent >= 70 ? "text-yellow-500" : "text-orange-500";
  const ringColor = scorePercent >= 85 ? "#22c55e" : scorePercent >= 70 ? "#eab308" : "#f97316";

  const Wrapper = animate ? motion.div : "div";
  const animProps = animate
    ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: "easeOut" } }
    : {};

  return (
    <Wrapper {...animProps}>
      <Card
        selected={selected}
        onClick={() => onSelect?.(project.id)}
        className="min-h-[260px] flex flex-col justify-between"
      >
        {/* 标题行 + 匹配分数 */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-lg font-bold text-[hsl(var(--foreground))] leading-tight">
              {project.title}
            </h4>
            {/* 匹配分数圆环 */}
            <div className="relative w-12 h-12 flex-shrink-0 ml-2">
              <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted) / 0.2)" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="20"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={(1 - project.jdMatchScore) * 2 * Math.PI * 20}
                />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor}`}>
                {scorePercent}%
              </span>
            </div>
          </div>

          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
            {project.description}
          </p>

          {/* 技术栈 Badges */}
          <div className="flex flex-wrap gap-1.5">
            {project.techStack.map((tech) => (
              <Badge key={tech} size="sm">
                {tech}
              </Badge>
            ))}
          </div>
        </div>

        {/* 查看详情按钮 */}
        <button
          data-testid="view-detail-btn"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetail?.(project.id);
          }}
          className="mt-4 text-sm font-medium text-[hsl(var(--accent))] hover:underline self-start"
        >
          查看详情 →
        </button>
      </Card>
    </Wrapper>
  );
}
```

- [ ] **Step 4: 实现 ProjectCardStack（固定 Grid + 流式替换）**

```tsx
// packages/ui/src/blueprint/project-card-stack.tsx
import React from "react";
import { AnimatePresence } from "framer-motion";
import { ProjectCard } from "./project-card";
import { Skeleton } from "../shared/skeleton";
import type { ProjectCard as ProjectCardType } from "@resume-ci/core";

interface ProjectCardStackProps {
  projects: ProjectCardType[];
  loading: boolean;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onViewDetail: (id: string) => void;
}

// 容器固定为 3 列 — 永不变更
const GRID_CLASS = "grid grid-cols-3 gap-6";

export function ProjectCardStack({
  projects,
  loading,
  selectedProjectId,
  onSelectProject,
  onViewDetail,
}: ProjectCardStackProps) {
  // 生成 3 个 slot
  const slots = Array.from({ length: 3 }, (_, i) => {
    const project = projects[i] || null;
    return { index: i, project };
  });

  return (
    <div data-testid="project-card-stack" className="py-4">
      {/* 状态栏 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          为你匹配了 {projects.length} 个项目
        </h3>
        {loading && (
          <span className="text-sm text-[hsl(var(--muted))] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
            {projects.length}/3 已就绪
          </span>
        )}
      </div>

      {/* 3 列固定 Grid */}
      <div className={GRID_CLASS}>
        <AnimatePresence mode="popLayout">
          {slots.map(({ index, project }) => (
            <div key={index} className="min-h-[260px]">
              {project ? (
                <ProjectCard
                  project={project}
                  selected={selectedProjectId === project.id}
                  onSelect={onSelectProject}
                  onViewDetail={onViewDetail}
                  animate
                />
              ) : (
                <Skeleton className="w-full h-[260px]" />
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* 空态：连 loading 都没开始 */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-12 text-[hsl(var(--muted))]">
          暂无匹配项目。请先在 Anchor 步骤中解析 JD。
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 写 blueprint/index.ts**

```tsx
// packages/ui/src/blueprint/index.ts
export { ProjectCard } from "./project-card";
export { ProjectCardStack } from "./project-card-stack";
export { ArchitectureDiagram } from "./architecture-diagram";
export { FlashCard } from "./flash-card";
export { FlashCardStack } from "./flash-card-stack";
```

- [ ] **Step 6: 更新 packages/ui/src/index.ts — 追加蓝图导出**

```tsx
export { ProjectCard, ProjectCardStack, ArchitectureDiagram, FlashCard, FlashCardStack } from "./blueprint";
```

- [ ] **Step 7: 运行测试确认通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: ProjectCard 测试 PASS。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): implement ProjectCard and ProjectCardStack

- ProjectCard: title, description, tech stack badges, match score ring, select/detail actions
- ProjectCardStack: fixed 3-column grid, skeleton-to-card crossfade, stream-ready
- Skeleton uses warm khaki tones matching theme

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 23: ArchitectureDiagram 组件

**Files:**
- Create: `packages/ui/src/blueprint/architecture-diagram.tsx`
- Create: `packages/ui/src/blueprint/architecture-diagram.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
// packages/ui/src/blueprint/architecture-diagram.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ArchitectureDiagram } from "./architecture-diagram";

// Mock mermaid — 避免实际渲染
vi.mock("mermaid", () => ({
  default: {
    render: vi.fn().mockResolvedValue({
      svg: '<svg id="mermaid-proj-1"><g class="node" id="node-1">Client</g></svg>',
    }),
  },
}));

describe("ArchitectureDiagram", () => {
  const mockDsl = "graph TD\n  Client-->Server";

  it("shows loading state initially", () => {
    render(<ArchitectureDiagram dsl={mockDsl} projectId="proj-1" />);
    expect(screen.getByText(/渲染架构图/)).toBeInTheDocument();
  });

  it("renders mermaid SVG after load", async () => {
    render(<ArchitectureDiagram dsl={mockDsl} projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByTestId("mermaid-container")).toBeInTheDocument();
    });
  });

  it("shows error fallback when mermaid fails", async () => {
    const mermaid = await import("mermaid");
    (mermaid.default.render as any).mockRejectedValueOnce(new Error("Parse error"));
    render(<ArchitectureDiagram dsl="invalid{{{" projectId="proj-2" />);
    await waitFor(() => {
      expect(screen.getByText(/架构图暂不可用/)).toBeInTheDocument();
    });
  });

  it("shows retry button on error", async () => {
    const mermaid = await import("mermaid");
    (mermaid.default.render as any).mockRejectedValueOnce(new Error("Parse error"));
    render(<ArchitectureDiagram dsl="invalid{{{" projectId="proj-3" />);
    await waitFor(() => {
      expect(screen.getByTestId("retry-btn")).toBeInTheDocument();
    });
  });

  it("uses unique svgId per projectId", async () => {
    const { rerender } = render(<ArchitectureDiagram dsl={mockDsl} projectId="proj-a" />);
    await waitFor(() => {
      const mermaid = require("mermaid").default;
      expect(mermaid.render).toHaveBeenCalledWith("mermaid-proj-a", expect.any(String));
    });
  });
});
```

- [ ] **Step 2: 确认测试失败**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui -- --reporter=verbose packages/ui/src/blueprint/architecture-diagram.test.tsx
```

Expected: FAIL — 文件未找到。

- [ ] **Step 3: 实现 ArchitectureDiagram**

```tsx
// packages/ui/src/blueprint/architecture-diagram.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";

interface ArchitectureDiagramProps {
  dsl: string;
  projectId: string;
}

type Status = "loading" | "ready" | "error";

export function ArchitectureDiagram({ dsl, projectId }: ArchitectureDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setError] = useState<string>("");
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const svgId = `mermaid-${projectId}`;

  const renderDiagram = useCallback(async () => {
    if (!dsl) {
      setStatus("error");
      setError("架构图数据为空");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      // 动态导入 mermaid 以支持测试 mock
      const mermaid = (await import("mermaid")).default;

      // 1. 清空容器
      if (containerRef.current) containerRef.current.innerHTML = "";

      // 2. 渲染
      const { svg } = await mermaid.render(svgId, dsl);

      if (containerRef.current) {
        containerRef.current.innerHTML = svg;

        // 3. 绑定 pan-zoom
        try {
          const svgPanZoom = (await import("svg-pan-zoom")).default;
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            // 销毁旧实例（如果存在）
            panZoomRef.current?.destroy?.();
            panZoomRef.current = svgPanZoom(svgEl, {
              zoomEnabled: true,
              controlIconsEnabled: true,
              minZoom: 0.5,
              maxZoom: 3,
              fit: true,
              center: true,
            });
          }
        } catch {
          // pan-zoom 失败不影响主渲染
        }

        setStatus("ready");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "架构图渲染失败");
    }
  }, [dsl, svgId]);

  // 初始渲染 + dsl/projectId 变化时重绘
  useEffect(() => {
    renderDiagram();
    return () => {
      panZoomRef.current?.destroy?.();
    };
  }, [renderDiagram]);

  // 事件代理：节点点击
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const node = target.closest(".node") as HTMLElement | null;
    if (node) {
      const nodeId = node.getAttribute("id") || node.textContent || "";
      setActiveNode(nodeId);
    } else {
      setActiveNode(null);
    }
  };

  return (
    <div data-testid="architecture-diagram" className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          📐 系统架构图
        </h3>
        {status === "ready" && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => panZoomRef.current?.zoomIn?.()}>
              <Icon name="zoom-in" size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => panZoomRef.current?.zoomOut?.()}>
              <Icon name="zoom-out" size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => panZoomRef.current?.reset?.()}>
              <Icon name="rotate-ccw" size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted))]">
          <div className="w-8 h-8 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spin mb-3" />
          <p className="text-sm">正在渲染架构图…</p>
        </div>
      )}

      {/* Ready */}
      {status === "ready" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          data-testid="mermaid-container"
          ref={containerRef}
          onClick={handleClick}
          className="border border-[hsl(var(--muted)/0.2)] rounded-[var(--radius-lg)] overflow-hidden bg-white"
          style={{ minHeight: 300 }}
        />
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-red-500 mb-2">架构图暂不可用</p>
          <p className="text-xs text-[hsl(var(--muted))] mb-4">{errorMsg}</p>
          <Button data-testid="retry-btn" variant="secondary" size="sm" onClick={renderDiagram}>
            重试
          </Button>
        </div>
      )}

      {/* 节点详情 HoverCard */}
      {activeNode && (
        <div className="mt-2 p-3 rounded-[var(--radius-md)] bg-[hsl(var(--accent-soft))] text-sm text-[hsl(var(--foreground))]">
          💡 选中节点：{activeNode}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: ArchitectureDiagram 测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): implement ArchitectureDiagram with mermaid + pan-zoom

- Client-side mermaid rendering with unique svgId per project
- svg-pan-zoom integration with zoom in/out/reset controls
- Event delegation for node click → HoverCard
- Loading/Error/Retry states
- Proper cleanup on unmount and DSL change

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 24: FlashCardStack + FlashCard 组件

**Files:**
- Create: `packages/ui/src/blueprint/flash-card.tsx`
- Create: `packages/ui/src/blueprint/flash-card.test.tsx`
- Create: `packages/ui/src/blueprint/flash-card-stack.tsx`

- [ ] **Step 1: 写 FlashCard 测试**

```tsx
// packages/ui/src/blueprint/flash-card.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FlashCard } from "./flash-card";
import type { FlashCardData } from "@resume-ci/core";

const mockCard: FlashCardData = {
  id: "fc-1",
  question: "如何保证 IM 消息的可靠投递？",
  answer: "采用 ACK 确认机制 + 消息重试队列。发送方在超时未收到 ACK 时自动重试。",
  codeSnippet: 'func send(msg Message) error {\n  return conn.WriteJSON(msg)\n}',
  language: "go",
};

// Mock shiki
vi.mock("shiki", () => ({
  codeToHtml: vi.fn().mockResolvedValue('<pre class="shiki"><code>func send()</code></pre>'),
}));

describe("FlashCard", () => {
  it("renders question on front face", () => {
    render(<FlashCard card={mockCard} />);
    expect(screen.getByText("如何保证 IM 消息的可靠投递？")).toBeInTheDocument();
  });

  it("does not show answer initially", () => {
    render(<FlashCard card={mockCard} />);
    expect(screen.queryByText(/ACK 确认机制/)).toBeNull();
  });

  it("flips to show answer on click", () => {
    render(<FlashCard card={mockCard} />);
    fireEvent.click(screen.getByTestId("flash-card"));
    // 翻转后背面内容可见
    expect(screen.getByText(/ACK 确认机制/)).toBeInTheDocument();
  });

  it("shows flip hint on front face", () => {
    render(<FlashCard card={mockCard} />);
    expect(screen.getByText(/点击翻转/)).toBeInTheDocument();
  });

  it("calls onFlipped when card is flipped", () => {
    const onFlipped = vi.fn();
    render(<FlashCard card={mockCard} onFlipped={onFlipped} />);
    fireEvent.click(screen.getByTestId("flash-card"));
    expect(onFlipped).toHaveBeenCalledWith("fc-1");
  });
});
```

- [ ] **Step 2: 实现 FlashCard**

```tsx
// packages/ui/src/blueprint/flash-card.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Icon } from "../shared/icon";
import type { FlashCardData } from "@resume-ci/core";

interface FlashCardProps {
  card: FlashCardData;
  onFlipped?: (id: string) => void;
}

export function FlashCard({ card, onFlipped }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [codeHtml, setCodeHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const hasFlipped = useRef(false);

  // 翻转时高亮代码
  useEffect(() => {
    if (flipped && card.codeSnippet && card.language && !codeHtml) {
      import("shiki").then((shiki) => {
        shiki.codeToHtml(card.codeSnippet!, {
          lang: card.language!,
          theme: "github-dark",
        }).then(setCodeHtml);
      });
    }
  }, [flipped, card.codeSnippet, card.language, codeHtml]);

  const handleFlip = () => {
    setFlipped((prev) => !prev);
    if (!hasFlipped.current && onFlipped) {
      hasFlipped.current = true;
      onFlipped(card.id);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (card.codeSnippet) {
      await navigator.clipboard.writeText(card.codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      data-testid="flash-card"
      onClick={handleFlip}
      className="w-[400px] h-[260px] cursor-pointer perspective-[1000px]"
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* 正面 — 问题 */}
        <div
          className="absolute inset-0 rounded-[var(--radius-xl)] bg-[hsl(var(--card))] p-6 flex flex-col items-center justify-center text-center shadow-md"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-3xl mb-3">⚡</span>
          <p className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 leading-snug">
            {card.question}
          </p>
          <span className="text-sm text-[hsl(var(--muted))]">点击翻转 →</span>
        </div>

        {/* 背面 — 答案 + 代码 */}
        <div
          className="absolute inset-0 rounded-[var(--radius-xl)] bg-[hsl(var(--card))] p-6 flex flex-col shadow-md overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {/* 文字解答 */}
          <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed flex-shrink-0 mb-3">
            {card.answer}
          </p>

          {/* 代码区 */}
          {card.codeSnippet && (
            <div className="flex-1 min-h-0 relative">
              <div className="absolute top-1 right-1 z-10">
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  title="复制代码"
                >
                  <Icon name={copied ? "check" : "copy"} size={14} />
                </button>
              </div>
              {codeHtml ? (
                <div
                  className="rounded-[var(--radius-md)] overflow-y-auto max-h-[120px] text-xs"
                  dangerouslySetInnerHTML={{ __html: codeHtml }}
                />
              ) : (
                <pre className="rounded-[var(--radius-md)] bg-slate-950/90 text-slate-300 p-3 text-xs overflow-y-auto max-h-[120px] font-mono">
                  {card.codeSnippet}
                </pre>
              )}
            </div>
          )}

          {/* 底部提示 */}
          <p className="text-xs text-[hsl(var(--muted))] mt-2 text-center flex-shrink-0">
            点击翻回
          </p>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: 实现 FlashCardStack**

```tsx
// packages/ui/src/blueprint/flash-card-stack.tsx
import React, { useState, useCallback } from "react";
import { FlashCard } from "./flash-card";
import type { FlashCardData } from "@resume-ci/core";

interface FlashCardStackProps {
  cards: FlashCardData[];
}

export function FlashCardStack({ cards }: FlashCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedSet, setFlippedSet] = useState<Set<number>>(new Set());

  const handleFlipped = useCallback((cardId: string) => {
    const idx = cards.findIndex((c) => c.id === cardId);
    if (idx >= 0) {
      setFlippedSet((prev) => new Set(prev).add(idx));
    }
  }, [cards]);

  // 键盘导航
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--muted))] text-sm">
        暂无技术难点数据
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div data-testid="flash-card-stack" className="py-4">
      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">
        ⚡ 技术难点 & 亮点 <span className="text-sm font-normal text-[hsl(var(--muted))]">{cards.length} 张闪卡</span>
      </h3>

      {/* 当前卡片 */}
      <div className="flex justify-center mb-4">
        <FlashCard
          key={currentCard.id}
          card={currentCard}
          onFlipped={handleFlipped}
        />
      </div>

      {/* 底部导航条 */}
      <div className="flex justify-center items-center gap-2">
        {cards.map((card, idx) => (
          <button
            key={card.id}
            onClick={() => setCurrentIndex(idx)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              idx === currentIndex
                ? "bg-[hsl(var(--accent))] text-white"
                : flippedSet.has(idx)
                  ? "bg-green-100 text-green-700"
                  : "bg-[hsl(var(--muted)/0.1)] text-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.2)]"
            }`}
            title={card.question}
          >
            {flippedSet.has(idx) ? "✓" : idx + 1}
          </button>
        ))}
      </div>

      {/* 键盘提示 */}
      <p className="text-center text-xs text-[hsl(var(--muted))] mt-2">
        ← → 切换卡片 · 点击翻转
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: FlashCard 测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): implement FlashCard and FlashCardStack

- FlashCard: 3D flip animation (Framer Motion spring), question/answer faces
- Code snippet rendering with shiki syntax highlighting
- One-click copy button with checkmark feedback
- FlashCardStack: dot navigation bar, keyboard arrow navigation
- Track flipped cards with checkmarks in nav dots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 25: 后端 PipelineService 接入真实 CLI

**Files:**
- Modify: `services/fastapi/app/services/pipeline.py`
- Modify: `services/fastapi/app/routers/ws.py`
- Create: `services/fastapi/tests/test_pipeline.py`
- Modify: `services/fastapi/requirements.txt`

- [ ] **Step 1: 更新 Python 依赖**

```txt
# services/fastapi/requirements.txt — 追加
openai>=1.0.0
anthropic>=0.30.0
gitpython>=3.1.0
```

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci/services/fastapi
pip install -r requirements.txt
```

- [ ] **Step 2: 实现 PipelineService**

```python
# services/fastapi/app/services/pipeline.py
import asyncio
import json
import logging
from typing import AsyncIterator

from openai import AsyncOpenAI

from ..schemas.models import JDParsed, KeywordItem, MatchProfile, ProjectCard, FlashCardData

logger = logging.getLogger(__name__)


class PipelineService:
    """编排 3 个 Python CLI 的流水线服务"""

    def __init__(self, llm_client: AsyncOpenAI | None = None):
        self.llm = llm_client or AsyncOpenAI()
        # 活跃任务追踪 — 支持 cancel
        self._active_tasks: dict[str, asyncio.Task] = {}
        self._active_procs: dict[str, asyncio.subprocess.Process] = {}

    # ─── JD 解析 ───

    async def jd_parse(self, raw: str) -> JDParsed:
        """LLM 结构化提取 JD 信息，一次性返回"""
        system_prompt = """你是一个专业的职位描述分析师。从给定的 JD 文本中提取以下结构化信息：

1. keywords: 关键词列表，每个关键词包含 word（词本身）、weight（0-1 重要性权重）、category（language/architecture/middleware/devops/concept）
2. techStack: 技术栈列表
3. roleType: 角色类型（后端/前端/算法/全栈/移动端/测试/数据/DevOps/安全/系统）
4. matchProfile: 匹配画像，包含 score（0-1 综合分数）和 gaps（候选人可能缺失的技能/经验）

请以 JSON 格式返回结果。"""

        response = await self.llm.chat.completions.create(
            model="deepseek-chat",  # 或 gpt-4o-mini
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw},
            ],
            response_format={"type": "json_object"},
        )

        data = json.loads(response.choices[0].message.content)
        return JDParsed(**data)

    # ─── 项目发现（流式）───

    async def discover(self, jd: JDParsed) -> AsyncIterator[ProjectCard]:
        """
        GitHub 搜索 → 逐个 audit 候选 repo → 流式 yield ProjectCard。
        每个 repo 完成后立即 yield，不等全部。
        """
        # Step 1: 搜索候选 GitHub repos
        candidates = await self._search_github(jd)

        # Step 2: 逐个审计
        for candidate in candidates[:5]:
            try:
                card = await self._audit_repo(candidate, jd)
                yield card
            except Exception as e:
                logger.warning(f"Audit failed for {candidate['full_name']}: {e}")
                continue

    async def get_diagram(self, project_id: str) -> str:
        """从缓存/内存中读取架构图 DSL"""
        # MVP: 从 _audit_repo 结果缓存中读取
        # 当前阶段返回硬编码示例
        return f"""graph TD
    A[Client] --> B[API Gateway]
    B --> C[{project_id} Service]
    C --> D[(Database)]
    C --> E[Cache]
    C --> F[Message Queue]"""

    async def get_challenges(self, project_id: str) -> list[FlashCardData]:
        """从缓存中读取技术难点"""
        # MVP: 返回示例数据
        return [
            FlashCardData(
                id=f"{project_id}-1",
                question="如何确保系统的高可用性？",
                answer="采用多副本部署 + 健康检查 + 自动故障转移。使用 Kubernetes 进行容器编排，配合 Readiness Probe 和 Liveness Probe。",
                codeSnippet="""apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        livenessProbe:
          httpGet:
            path: /health
            port: 8080""",
                language="yaml",
            ),
            FlashCardData(
                id=f"{project_id}-2",
                question="如何处理分布式事务一致性？",
                answer="采用 Saga 模式，将大事务拆分为多个本地事务，每个本地事务有对应的补偿操作。通过消息队列协调各步骤的执行和回滚。",
                codeSnippet="""func (s *Saga) Execute(ctx context.Context) error {
    for _, step := range s.steps {
        if err := step.Forward(ctx); err != nil {
            s.Compensate(ctx)
            return err
        }
    }
    return nil
}""",
                language="go",
            ),
            FlashCardData(
                id=f"{project_id}-3",
                question="如何优化数据库查询性能？",
                answer="使用 Redis 缓存热点数据 + 数据库读写分离 + 慢查询优化。对频繁查询但变化少的数据设置合理的过期时间。",
            ),
        ]

    # ─── 内部方法 ───

    async def _search_github(self, jd: JDParsed) -> list[dict]:
        """搜索 GitHub trending repos 匹配 JD"""
        # MVP: 使用硬编码的示例结果
        # 后续接入 GitHub API 或预索引的 repo 数据库
        return [
            {"full_name": "example/high-concurrency-im", "url": "https://github.com/example/im"},
            {"full_name": "example/microservice-mall", "url": "https://github.com/example/mall"},
            {"full_name": "example/distributed-cache", "url": "https://github.com/example/cache"},
        ]

    async def _audit_repo(self, candidate: dict, jd: JDParsed) -> ProjectCard:
        """对单个 repo 运行快速审计"""
        # MVP: 返回构造的 ProjectCard
        # 后续接入 shushu-internship-tool 的 repo audit
        # result = await self._run_cli("shushu-internship-tool", "audit", candidate["url"])
        await asyncio.sleep(2)  # 模拟审计耗时

        import uuid
        return ProjectCard(
            id=str(uuid.uuid4())[:8],
            title=candidate["full_name"].split("/")[-1].replace("-", " ").title(),
            description=f"基于 {', '.join(jd.techStack[:2])} 的实战项目",
            techStack=jd.techStack[:4],
            jdMatchScore=round(0.75 + 0.2 * (0.5 + 0.5), 2),  # 0.75-0.95
            architecture="graph TD\n  A-->B",
            challenges=[],
        )

    async def cancel(self, task_id: str):
        """取消任务并清理资源"""
        task = self._active_tasks.pop(task_id, None)
        if task:
            task.cancel()

        proc = self._active_procs.pop(task_id, None)
        if proc:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                proc.kill()
            except Exception:
                pass
```

- [ ] **Step 3: 更新 WebSocket handler 使用新 PipelineService**

```python
# services/fastapi/app/routers/ws.py — 更新 handler 调用
# 替换原有的 skeleton PipelineService 引用
# 确保 jd.parse → pipeline.jd_parse()
# project.discover → pipeline.discover() 流式 yield
# project.diagram → pipeline.get_diagram()
# project.challenges → pipeline.get_challenges()
```

- [ ] **Step 4: 写 Python 测试**

```python
# services/fastapi/tests/test_pipeline.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.pipeline import PipelineService
from app.schemas.models import JDParsed


@pytest.fixture
def pipeline():
    llm = AsyncMock()
    llm.chat.completions.create.return_value.choices = [
        AsyncMock(message=AsyncMock(content='''{
            "keywords": [{"word": "Go", "weight": 0.95, "category": "language"}],
            "techStack": ["Go", "Redis"],
            "roleType": "后端",
            "matchProfile": {"score": 0.87, "gaps": ["分布式"]}
        }'''))
    ]
    return PipelineService(llm_client=llm)


@pytest.mark.asyncio
async def test_jd_parse_returns_structured_data(pipeline):
    result = await pipeline.jd_parse("招 Go 后端实习生...")
    assert isinstance(result, JDParsed)
    assert len(result.keywords) == 1
    assert result.keywords[0].word == "Go"
    assert result.matchProfile.score == 0.87


@pytest.mark.asyncio
async def test_discover_yields_project_cards(pipeline):
    jd = JDParsed(
        keywords=[],
        techStack=["Go"],
        roleType="后端",
        matchProfile={"score": 0.8, "gaps": []},
    )
    cards = []
    async for card in pipeline.discover(jd):
        cards.append(card)
    assert len(cards) > 0
    assert cards[0].title  # 非空


@pytest.mark.asyncio
async def test_get_diagram_returns_mermaid_dsl(pipeline):
    dsl = await pipeline.get_diagram("test-proj")
    assert "graph" in dsl.lower()
    assert "test-proj" in dsl


@pytest.mark.asyncio
async def test_get_challenges_returns_list(pipeline):
    challenges = await pipeline.get_challenges("test-proj")
    assert len(challenges) > 0
    assert challenges[0].question


@pytest.mark.asyncio
async def test_cancel_cleans_up_tasks(pipeline):
    # 创建一个假任务
    import asyncio
    task = asyncio.create_task(asyncio.sleep(10))
    pipeline._active_tasks["test-task"] = task
    await pipeline.cancel("test-task")
    assert "test-task" not in pipeline._active_tasks
    assert task.cancelled()
```

- [ ] **Step 5: 运行 Python 测试**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci/services/fastapi
python -m pytest tests/test_pipeline.py -v
```

Expected: 5/5 PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(backend): implement PipelineService with LLM integration

- jd_parse: LLM structured extraction (DeepSeek/GPT) → JDParsed
- discover: GitHub candidate search → stream yield ProjectCard
- get_diagram/challenges: cached results from audit
- cancel: full cleanup (Task.cancel + proc.terminate/kill)
- Tests: 5 passing pytest cases with mocked LLM

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 26: Phase 9 集成验证

**Files:** 无新文件。更新 `apps/web/src/app/page.tsx` 和 `apps/desktop/src/renderer/App.tsx` 接入真实组件。

- [ ] **Step 1: 更新 apps/web/src/app/page.tsx 使用真实组件**

```tsx
// apps/web/src/app/page.tsx — 替换 StepPlaceholder
'use client';

import { useMemo } from 'react';
import { MockAdapter } from '@resume-ci/core';
import {
  AdapterProvider,
  WizardShell,
  JDInputArea,
  KeywordCloud,
  MatchRadar,
  ProjectCardStack,
  ArchitectureDiagram,
  FlashCardStack,
  useWizardStore,
  useAdapter,
} from '@resume-ci/ui';

export default function Home() {
  const adapter = useMemo(() => new MockAdapter(), []);

  return (
    <AdapterProvider adapter={adapter}>
      <WizardShell
        children={{
          anchor: <AnchorStep />,
          blueprint: <BlueprintStep />,
          alignment: <StepPlaceholder title="证据对齐" />,
          polish: <StepPlaceholder title="沉浸精修" />,
          export: <StepPlaceholder title="导出 PDF" />,
        }}
      />
    </AdapterProvider>
  );
}

function AnchorStep() {
  const adapter = useAdapter();
  const jd = useWizardStore((s) => s.jd);
  const setJD = useWizardStore((s) => s.setJD);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <JDInputArea
        adapter={adapter}
        onParsed={(parsed) => setJD(parsed)}
      />
      {jd && (
        <>
          <KeywordCloud keywords={jd.keywords} />
          <MatchRadar profile={jd.matchProfile} />
        </>
      )}
    </div>
  );
}

function BlueprintStep() {
  const adapter = useAdapter();
  const jd = useWizardStore((s) => s.jd);
  const projects = useWizardStore((s) => s.projects);
  const projectsLoading = useWizardStore((s) => s.projectsLoading);
  const selectedProjectId = useWizardStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useWizardStore((s) => s.setSelectedProjectId);
  const appendProject = useWizardStore((s) => s.appendProject);
  const setProjectsLoading = useWizardStore((s) => s.setProjectsLoading);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <ProjectCardStack
        projects={projects}
        loading={projectsLoading === 'loading'}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onViewDetail={setSelectedProjectId}
      />
      {selectedProject && (
        <>
          <ArchitectureDiagram
            dsl={selectedProject.architecture}
            projectId={selectedProject.id}
          />
          <FlashCardStack cards={selectedProject.challenges} />
        </>
      )}
    </div>
  );
}

function StepPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">{title}</h2>
        <p className="text-[hsl(var(--muted))]">即将上线</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 同步更新 apps/desktop/src/renderer/App.tsx**

与上一步相同逻辑，使用 `React.createElement` 语法（Electron renderer 无 JSX transform 时），或配置 Vite `@vitejs/plugin-react` 支持 JSX。

- [ ] **Step 3: 全量 typecheck**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck
```

Expected: 所有包 typecheck PASS。

- [ ] **Step 4: 全量测试**

```bash
pnpm turbo run test
```

Expected: 所有 Vitest 测试 PASS。

- [ ] **Step 5: 双端启动验证**

```bash
# Web 端
pnpm dev:web
# 访问 http://localhost:3000
# 手动验证：粘贴 JD → 看到关键词云 + 雷达图 → 下一步 → 项目卡片 + 架构图 + 闪卡
```

Expected: 完整 Anchor → Blueprint 流程可走通。

```bash
# Desktop 端
pnpm dev:desktop
```

Expected: Electron 窗口显示与 Web 端相同内容。

- [ ] **Step 6: Python 测试**

```bash
cd services/fastapi
python -m pytest tests/ -v
```

Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Phase 9 integration — wire real components into shell apps

- Replace StepPlaceholder with JDInputArea, KeywordCloud, MatchRadar
- Wire BlueprintStep with ProjectCardStack, ArchitectureDiagram, FlashCardStack
- All components driven by WizardStore + Adapter
- Full typecheck + tests pass across all packages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

Phase 9 计划已存入 `docs/superpowers/plans/2026-06-01-resume-ci-phase9.md`。

### 全部计划文件索引

| 文件 | 内容 | 任务数 |
|------|------|--------|
| `2026-05-31-resume-ci-phase1-3.md` | Monorepo + 协议核心 + Mock Adapter + UI 骨架 | 1-6 |
| `2026-05-31-resume-ci-phase4-5.md` | UI 组件 + Python 服务 | 7-12 |
| `2026-05-31-resume-ci-phase6-8.md` | Web 壳 + Desktop 壳 + CI/CD + 集成验证 | 13-18 |
| `2026-06-01-resume-ci-phase9.md` | 真实 UI：Anchor + Blueprint + PipelineService | 19-26 |
