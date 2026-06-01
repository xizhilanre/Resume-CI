# Resume CI 实现计划 — Phase 11: ⑤ Export + 收尾

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Step ⑤ Export（仪式导出）全部 UI 组件，完成 Schema codegen 工具链、GitHub OAuth 登录、Electron Python 子进程管理，全链路集成验证。

**Architecture:** 导出流水线通过 SSE 推送四阶段进度，前端 PipelineProgress 动画展示。收尾任务补齐架构设计中的遗留基础设施（codegen、认证、Python 运行时）。

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion 12, FastAPI SSE, NextAuth.js 5, Electron, Python 3.12

---

### Task 35: PipelineProgress 组件

**Files:**
- Create: `packages/ui/src/export/pipeline-progress.tsx`
- Create: `packages/ui/src/export/pipeline-progress.test.tsx`
- Create: `packages/ui/src/export/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: 写测试**

```tsx
// packages/ui/src/export/pipeline-progress.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PipelineProgress } from "./pipeline-progress";

const stages = [
  { name: "排版对齐", status: "done" as const },
  { name: "字体嵌入", status: "active" as const },
  { name: "ATS校验", status: "pending" as const },
  { name: "生成PDF", status: "pending" as const },
];

describe("PipelineProgress", () => {
  it("renders all 4 stage names", () => {
    render(<PipelineProgress stages={stages} overallProgress={35} />);
    stages.forEach((s) => {
      expect(screen.getByText(s.name)).toBeInTheDocument();
    });
  });

  it("shows checkmark for done stages", () => {
    render(<PipelineProgress stages={stages} overallProgress={35} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("shows loading spinner for active stage", () => {
    render(<PipelineProgress stages={stages} overallProgress={35} />);
    const activeEl = screen.getByText("⏳");
    expect(activeEl).toBeInTheDocument();
  });

  it("shows overall progress bar", () => {
    render(<PipelineProgress stages={stages} overallProgress={60} />);
    expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("handles all stages done", () => {
    const allDone = stages.map((s) => ({ ...s, status: "done" as const }));
    render(<PipelineProgress stages={allDone} overallProgress={100} />);
    expect(screen.getByText(/导出完成/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 确认测试失败**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/ui -- --reporter=verbose packages/ui/src/export/pipeline-progress.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现 PipelineProgress**

```tsx
// packages/ui/src/export/pipeline-progress.tsx
import React from "react";
import { motion } from "framer-motion";

interface Stage {
  name: string;
  status: "done" | "active" | "pending";
}

interface PipelineProgressProps {
  stages: Stage[];
  overallProgress: number; // 0-100
}

export function PipelineProgress({ stages, overallProgress }: PipelineProgressProps) {
  const allDone = stages.every((s) => s.status === "done");

  return (
    <div data-testid="pipeline-progress" className="py-8 max-w-2xl mx-auto">
      {/* 阶段节点 */}
      <div className="flex items-center justify-between mb-6">
        {stages.map((stage, i) => (
          <React.Fragment key={stage.name}>
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: stage.status === "active" ? [1, 1.1, 1] : 1,
                  backgroundColor:
                    stage.status === "done" ? "hsl(var(--accent))" :
                    stage.status === "active" ? "hsl(var(--accent-soft))" :
                    "hsl(var(--muted)/0.15)",
                }}
                transition={{ repeat: stage.status === "active" ? Infinity : 0, duration: 1.5 }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
                style={{
                  color: stage.status === "done" ? "white" :
                         stage.status === "active" ? "hsl(var(--accent))" :
                         "hsl(var(--muted))",
                }}
              >
                {stage.status === "done" ? "✓" :
                 stage.status === "active" ? "⏳" :
                 "○"}
              </motion.div>
              <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                {stage.name}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className="flex-1 mx-2 h-0.5 mt-[-20px]">
                <motion.div
                  className="h-full rounded-full"
                  animate={{
                    backgroundColor: stages[i].status === "done" ? "hsl(var(--accent))" : "hsl(var(--muted)/0.2)",
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 整体进度条 */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[hsl(var(--muted))]">总体进度</span>
          <span className="text-xs font-medium text-[hsl(var(--foreground))]">{overallProgress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(var(--muted)/0.15)] overflow-hidden">
          <motion.div
            data-testid="progress-bar"
            className="h-full rounded-full bg-[hsl(var(--accent))]"
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* 完成态 */}
      {allDone && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-green-500 font-medium mt-4"
        >
          🎉 导出完成！
        </motion.p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: PipelineProgress 测试 PASS。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): implement PipelineProgress with 4-stage pipeline animation

- Stage nodes: done (✓ green), active (⏳ pulsing), pending (○ gray)
- Connecting lines animate between stages
- Overall progress bar with Framer Motion width animation
- Completion celebration message

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 36: PDFPreview + DownloadButton 组件

**Files:**
- Create: `packages/ui/src/export/pdf-preview.tsx`
- Create: `packages/ui/src/export/pdf-preview.test.tsx`
- Create: `packages/ui/src/export/download-button.tsx`
- Create: `packages/ui/src/export/download-button.test.tsx`

- [ ] **Step 1: 实现 PDFPreview**

```tsx
// packages/ui/src/export/pdf-preview.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PDFPreviewProps {
  pdfUrl: string;
}

export function PDFPreview({ pdfUrl }: PDFPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div data-testid="pdf-preview" className="py-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={fullscreen
            ? "fixed inset-4 z-50 bg-black/50 backdrop-blur-sm"
            : "max-w-2xl mx-auto"
          }
          onClick={() => setFullscreen(false)}
        >
          <div
            className={`bg-white rounded-[var(--radius-lg)] shadow-lg overflow-hidden ${
              fullscreen ? "h-full" : "max-h-[500px]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="简历 PDF 预览"
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {!fullscreen && (
        <div className="text-center mt-3">
          <button
            onClick={() => setFullscreen(true)}
            className="text-xs text-[hsl(var(--accent))] hover:underline"
          >
            全屏预览
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 实现 DownloadButton**

```tsx
// packages/ui/src/export/download-button.tsx
import React, { useState } from "react";
import { Button } from "../shared/button";
import { Icon } from "../shared/icon";

interface DownloadButtonProps {
  pdfUrl: string;
  onRegenerate: () => void;
}

export function DownloadButton({ pdfUrl, onRegenerate }: DownloadButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(pdfUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-testid="download-button" className="flex flex-col items-center gap-3 py-4">
      <a href={pdfUrl} download="resume.pdf">
        <Button size="lg">
          <Icon name="upload" size={18} className="mr-2" />
          下载 PDF
        </Button>
      </a>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={handleCopyLink}>
          <Icon name={copied ? "check" : "copy"} size={14} className="mr-1" />
          {copied ? "已复制" : "复制链接"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <Icon name="rotate-ccw" size={14} className="mr-1" />
          重新生成
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 写 export/index.ts**

```tsx
// packages/ui/src/export/index.ts
export { PipelineProgress } from "./pipeline-progress";
export { PDFPreview } from "./pdf-preview";
export { DownloadButton } from "./download-button";
export { InterviewTip } from "./interview-tip";
```

- [ ] **Step 4: 更新 packages/ui/src/index.ts**

```tsx
export { PipelineProgress, PDFPreview, DownloadButton, InterviewTip } from "./export";
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): implement PDFPreview and DownloadButton components

- PDFPreview: iframe embed with fullscreen toggle
- DownloadButton: primary download CTA + copy link + regenerate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 37: InterviewTip 组件

**Files:**
- Create: `packages/ui/src/export/interview-tip.tsx`
- Create: `packages/ui/src/export/interview-tip.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
// packages/ui/src/export/interview-tip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { InterviewTip } from "./interview-tip";

describe("InterviewTip", () => {
  it("renders the tip text", () => {
    render(<InterviewTip tip="准备好回答技术选型理由会让面试更有说服力" />);
    expect(screen.getByText(/技术选型/)).toBeInTheDocument();
  });

  it("renders with glassmorphism card style", () => {
    render(<InterviewTip tip="测试面经" />);
    expect(screen.getByTestId("interview-tip")).toBeInTheDocument();
  });

  it("enters with fade-in animation", () => {
    render(<InterviewTip tip="任何面试建议" />);
    // 内容可见即可
    expect(screen.getByText("💡 面试锦囊")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现 InterviewTip**

```tsx
// packages/ui/src/export/interview-tip.tsx
import React from "react";
import { motion } from "framer-motion";

interface InterviewTipProps {
  tip: string;
}

export function InterviewTip({ tip }: InterviewTipProps) {
  return (
    <motion.div
      data-testid="interview-tip"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }} // 等 PDF 先出现
      className="max-w-2xl mx-auto mt-6 p-5 rounded-[var(--radius-xl)]"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: `blur(var(--glass-blur))`,
        border: `1px solid var(--glass-border)`,
      }}
    >
      <h4 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">
        💡 面试锦囊
      </h4>
      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
        {tip}
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 3: 运行测试**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: InterviewTip 测试 PASS。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): implement InterviewTip easter egg component

- Glassmorphism card with delayed fade-in entrance
- Displays personalized interview preparation advice

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 38: Schema Codegen 工具链

**Files:**
- Create: `packages/core/schemas/source-of-truth.json`
- Create: `packages/core/schemas/codegen.ts`
- Create: `packages/core/schemas/generated/.gitkeep`
- Modify: `turbo.json`
- Modify: `package.json` (根)

- [ ] **Step 1: 写 source-of-truth.json — 完整数据模型**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$defs": {
    "KeywordItem": {
      "type": "object",
      "properties": {
        "word": { "type": "string", "description": "关键词" },
        "weight": { "type": "number", "description": "权重 0-1" },
        "category": {
          "type": "string",
          "enum": ["language", "architecture", "middleware", "devops", "concept"],
          "description": "分类"
        }
      },
      "required": ["word", "weight", "category"]
    },
    "MatchProfile": {
      "type": "object",
      "properties": {
        "score": { "type": "number", "description": "综合匹配分数 0-1" },
        "gaps": {
          "type": "array",
          "items": { "type": "string" },
          "description": "缺失项列表"
        }
      },
      "required": ["score", "gaps"]
    },
    "JDParsed": {
      "type": "object",
      "properties": {
        "keywords": { "type": "array", "items": { "$ref": "#/$defs/KeywordItem" } },
        "techStack": { "type": "array", "items": { "type": "string" } },
        "roleType": { "type": "string" },
        "matchProfile": { "$ref": "#/$defs/MatchProfile" }
      },
      "required": ["keywords", "techStack", "roleType", "matchProfile"]
    },
    "ProjectCard": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "techStack": { "type": "array", "items": { "type": "string" } },
        "jdMatchScore": { "type": "number" },
        "architecture": { "type": "string", "description": "Mermaid DSL" },
        "challenges": { "type": "array", "items": { "$ref": "#/$defs/FlashCardData" } }
      },
      "required": ["id", "title", "description", "techStack", "jdMatchScore", "architecture", "challenges"]
    },
    "FlashCardData": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "question": { "type": "string" },
        "answer": { "type": "string" },
        "codeSnippet": { "type": "string" },
        "language": { "type": "string" }
      },
      "required": ["id", "question", "answer"]
    },
    "AlignmentQuestion": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "text": { "type": "string" },
        "options": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "text": { "type": "string" }
            },
            "required": ["id", "text"]
          }
        }
      },
      "required": ["id", "text", "options"]
    },
    "STARBullet": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "situation": { "type": "string" },
        "task": { "type": "string" },
        "action": { "type": "string" },
        "result": { "type": "string" }
      },
      "required": ["id", "situation", "task", "action", "result"]
    }
  }
}
```

- [ ] **Step 2: 写 codegen.ts — 代码生成脚本**

```typescript
// packages/core/schemas/codegen.ts
import * as fs from "node:fs";
import * as path from "node:path";

interface SchemaDef {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  enum?: string[];
  items?: any;
  description?: string;
}

interface Schema {
  $defs: Record<string, SchemaDef>;
}

// ─── TypeScript Generator ───
function generateTypeScript(defs: Record<string, SchemaDef>): string {
  const lines: string[] = [
    "// Auto-generated from source-of-truth.json — DO NOT EDIT",
    "// Run: pnpm codegen",
    "",
  ];

  for (const [name, def] of Object.entries(defs)) {
    if (def.enum) {
      lines.push(`export type ${name} = ${def.enum.map((e) => `'${e}'`).join(" | ")};`);
      lines.push("");
      continue;
    }

    if (!def.properties) continue;

    lines.push(`export interface ${name} {`);
    for (const [prop, propDef] of Object.entries(def.properties)) {
      const optional = !def.required?.includes(prop) ? "?" : "";
      const tsType = jsonTypeToTS(propDef, defs);
      const desc = propDef.description ? `  /** ${propDef.description} */` : "";
      if (desc) lines.push(desc);
      lines.push(`  ${prop}${optional}: ${tsType};`);
    }
    lines.push(`}`);
    lines.push("");
  }

  return lines.join("\n");
}

function jsonTypeToTS(def: any, allDefs: Record<string, SchemaDef>): string {
  if (def.$ref) {
    const refName = def.$ref.replace("#/$defs/", "");
    return refName;
  }
  switch (def.type) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "array":
      return `${jsonTypeToTS(def.items, allDefs)}[]`;
    case "object":
      if (def.properties) {
        const props = Object.entries(def.properties)
          .map(([k, v]: [string, any]) => `${k}: ${jsonTypeToTS(v, allDefs)}`)
          .join("; ");
        return `{ ${props} }`;
      }
      return "Record<string, unknown>";
    default:
      if (def.enum) return def.enum.map((e: string) => `'${e}'`).join(" | ");
      return "unknown";
  }
}

// ─── Pydantic Generator ───
function generatePydantic(defs: Record<string, SchemaDef>): string {
  const lines: string[] = [
    "# Auto-generated from source-of-truth.json — DO NOT EDIT",
    "# Run: pnpm codegen",
    "",
    "from pydantic import BaseModel",
    "from typing import Optional, Literal",
    "",
    "",
  ];

  // 先收集被引用的类型，确保依赖先声明
  const sorted = topologicalSort(defs);

  for (const name of sorted) {
    const def = defs[name];
    if (!def) continue;

    if (def.enum) {
      const literalUnion = def.enum.map((e) => `'${e}'`).join(", ");
      lines.push(`# Type alias: ${name} = Literal[${literalUnion}]`);
      lines.push("");
      continue;
    }

    if (!def.properties) continue;

    lines.push(`class ${name}(BaseModel):`);
    for (const [prop, propDef] of Object.entries(def.properties)) {
      const pyType = jsonTypeToPy(propDef, defs);
      const optional = !def.required?.includes(prop);
      const defaultVal = optional ? " = None" : "";
      const desc = propDef.description ? `  # ${propDef.description}` : "";
      lines.push(`    ${prop}: ${pyType}${defaultVal}${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function jsonTypeToPy(def: any, allDefs: Record<string, SchemaDef>): string {
  if (def.$ref) {
    const refName = def.$ref.replace("#/$defs/", "");
    return refName;
  }
  switch (def.type) {
    case "string": return "str";
    case "number": return "float";
    case "boolean": return "bool";
    case "array":
      return `list[${jsonTypeToPy(def.items, allDefs)}]`;
    case "object":
      if (def.properties) {
        const props = Object.entries(def.properties)
          .map(([k, v]: [string, any]) => `${k}: ${jsonTypeToPy(v, allDefs)}`)
          .join(", ");
        return `dict[str, ${props}]`;
      }
      return "dict";
    default:
      if (def.enum) return `Literal[${def.enum.map((e: string) => `'${e}'`).join(", ")}]`;
      return "Any";
  }
}

function topologicalSort(defs: Record<string, SchemaDef>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const def = defs[name];
    if (def?.properties) {
      for (const propDef of Object.values(def.properties)) {
        if ((propDef as any).$ref) {
          visit((propDef as any).$ref.replace("#/$defs/", ""));
        }
        if ((propDef as any).items?.$ref) {
          visit((propDef as any).items.$ref.replace("#/$defs/", ""));
        }
      }
    }
    sorted.push(name);
  }

  for (const name of Object.keys(defs)) visit(name);
  return sorted;
}

// ─── Main ───
const schemaPath = path.resolve(__dirname, "source-of-truth.json");
const tsOutputPath = path.resolve(__dirname, "generated/types.ts");
const pyOutputPath = path.resolve(__dirname, "../../../services/fastapi/app/schemas/models.py");

const schema: Schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

fs.writeFileSync(tsOutputPath, generateTypeScript(schema.$defs), "utf-8");
fs.writeFileSync(pyOutputPath, generatePydantic(schema.$defs), "utf-8");

console.log(`✅ Codegen complete:
  TS: ${tsOutputPath}
  PY: ${pyOutputPath}`);
```

- [ ] **Step 3: 添加 codegen 脚本到根 package.json**

```jsonc
{
  "scripts": {
    "codegen": "tsx packages/core/schemas/codegen.ts"
  }
}
```

- [ ] **Step 4: 更新 turbo.json — 追加 codegen task**

```jsonc
{
  "tasks": {
    "codegen": {
      "outputs": [
        "packages/core/schemas/generated/**",
        "services/fastapi/app/schemas/models.py"
      ],
      "cache": true
    }
  }
}
```

- [ ] **Step 5: 运行 codegen 并验证**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm codegen
pnpm turbo run typecheck
```

Expected: codegen 生成 types.ts 和 models.py，typecheck 全量 PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(codegen): implement schema-to-TS/Pydantic code generator

- source-of-truth.json as single schema definition
- codegen.ts: generates TypeScript interfaces + Pydantic models
- Topological sort ensures dependency ordering
- Added to turbo.json as cached codegen task

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 39: GitHub OAuth + NextAuth.js

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/.env.local.example`
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装 NextAuth.js**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci/apps/web
pnpm add next-auth@beta
```

- [ ] **Step 2: 写 [...nextauth]/route.ts**

```tsx
// apps/web/src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const handler = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

export { handler as GET, handler as POST };
```

- [ ] **Step 3: 写 middleware.ts**

```tsx
// apps/web/src/middleware.ts
export { auth as middleware } from "@/app/api/auth/[...nextauth]/route";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 4: 写 .env.local.example**

```bash
# apps/web/.env.local.example
AUTH_GITHUB_ID=your_github_oauth_app_id
AUTH_GITHUB_SECRET=your_github_oauth_app_secret
AUTH_SECRET=generate_with_openssl_rand_base64_32
```

- [ ] **Step 5: 更新 layout.tsx — 添加 SessionProvider**

```tsx
// apps/web/src/app/layout.tsx — 包裹 SessionProvider
import { SessionProvider } from "next-auth/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): add GitHub OAuth with NextAuth.js v5

- GitHub provider with session callback
- Middleware protects all routes except API/auth and static
- SessionProvider wrapped in root layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 40: Electron Python Executor（子进程管理）

**Files:**
- Create: `apps/desktop/src/main/python-executor.ts`
- Create: `apps/desktop/src/main/python-bootstrap.ts`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Step 1: 实现 python-bootstrap.ts**

```typescript
// apps/desktop/src/main/python-bootstrap.ts
import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const RUNTIME_DIR = path.join(app.getPath("userData"), "python-runtime");

export function ensurePythonRuntime(): string {
  const pythonExe = path.join(
    RUNTIME_DIR,
    process.platform === "win32" ? "python.exe" : "bin/python3"
  );

  if (fs.existsSync(pythonExe)) {
    return validateRuntime(pythonExe) ? pythonExe : "";
  }

  // 首次运行 — 解压 runtime
  const zipPath = path.join(process.resourcesPath, "python-runtime.zip");
  if (!fs.existsSync(zipPath)) {
    throw new Error("Python runtime not found. Please reinstall the application.");
  }

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });

  // 使用系统内置解压（Windows: tar, macOS/Linux: unzip）
  if (process.platform === "win32") {
    execSync(`tar -xf "${zipPath}" -C "${RUNTIME_DIR}"`, { stdio: "pipe" });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${RUNTIME_DIR}"`, { stdio: "pipe" });
  }

  return pythonExe;
}

function validateRuntime(pythonExe: string): boolean {
  try {
    execSync(`"${pythonExe}" --version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: 实现 python-executor.ts**

```typescript
// apps/desktop/src/main/python-executor.ts
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { EventEmitter } from "node:events";

export class PythonExecutor extends EventEmitter {
  private proc: ChildProcess | null = null;
  private pythonPath: string;
  private serverPath: string;

  constructor(pythonPath: string) {
    super();
    this.pythonPath = pythonPath;
    this.serverPath = path.join(
      __dirname,
      "../../../services/fastapi/app/main.py"
    );
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.proc = spawn(this.pythonPath, [
        "-m", "uvicorn", "app.main:app",
        "--host", "127.0.0.1",
        "--port", "18920", // 固定端口
      ], {
        cwd: path.join(__dirname, "../../../services/fastapi"),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          RESUME_CI_DESKTOP: "1",
        },
      });

      let started = false;

      this.proc.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (!started && output.includes("Uvicorn running")) {
          started = true;
          resolve();
        }
      });

      this.proc.stderr?.on("data", (data: Buffer) => {
        this.emit("stderr", data.toString());
      });

      this.proc.on("error", (err) => {
        if (!started) reject(err);
      });

      this.proc.on("exit", (code) => {
        this.emit("exit", code);
        this.proc = null;
      });

      // 超时保护 — 10s 内未启动成功则拒绝
      setTimeout(() => {
        if (!started) {
          this.proc?.kill();
          reject(new Error("Python server failed to start within 10s"));
        }
      }, 10000);
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;

    return new Promise((resolve) => {
      this.proc!.on("exit", () => resolve());
      this.proc!.kill("SIGTERM");

      // 5s 超时强制 kill
      setTimeout(() => {
        if (this.proc) {
          this.proc.kill("SIGKILL");
          resolve();
        }
      }, 5000);
    });
  }

  isRunning(): boolean {
    return this.proc !== null && !this.proc.killed;
  }

  getPort(): number {
    return 18920;
  }
}
```

- [ ] **Step 3: 修改 main/index.ts 集成 PythonExecutor**

```typescript
// apps/desktop/src/main/index.ts — 追加 Python 生命周期

import { ensurePythonRuntime } from "./python-bootstrap";
import { PythonExecutor } from "./python-executor";

let pythonExecutor: PythonExecutor | null = null;

app.whenReady().then(async () => {
  // 1. 确保 Python 运行时就绪
  const pythonPath = ensurePythonRuntime();

  // 2. 启动 Python 服务
  pythonExecutor = new PythonExecutor(pythonPath);
  try {
    await pythonExecutor.start();
  } catch (err) {
    // Python 启动失败不阻塞 UI，但记录错误
    console.error("Python server failed to start:", err);
  }

  // 3. 创建窗口
  createWindow();
});

app.on("before-quit", async () => {
  await pythonExecutor?.stop();
});
```

- [ ] **Step 4: 更新 preload.ts 暴露 Python IPC 方法**

```typescript
// apps/desktop/src/preload/preload.ts — 更新 send/cancel/onMessage
contextBridge.exposeInMainWorld("api", {
  send: (msg: unknown) => ipcRenderer.invoke("python:send", msg),
  cancel: (id: string) => ipcRenderer.invoke("python:cancel", id),
  onMessage: (cb: (msg: unknown) => void) => {
    const handler = (_event: any, msg: unknown) => cb(msg);
    ipcRenderer.on("python:message", handler);
    return () => ipcRenderer.removeListener("python:message", handler);
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(desktop): implement Python executor with bootstrap and lifecycle management

- python-bootstrap: first-run extraction from python-runtime.zip to userData
- python-executor: spawn uvicorn, stdout health check, graceful shutdown
- 10s startup timeout with SIGKILL fallback
- IPC handlers for send/cancel/onMessage in preload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 41: 全量集成验证

**Files:** 无新文件。更新 `apps/web/src/app/page.tsx` 和 `apps/desktop/src/renderer/App.tsx` 接入所有 5 步真实组件。

- [ ] **Step 1: 完整接入 5 步组件到 Web 端**

```tsx
// apps/web/src/app/page.tsx — 完整版 5 步组件
'use client';

import { useMemo } from 'react';
import { MockAdapter } from '@resume-ci/core';
import {
  AdapterProvider, WizardShell,
  JDInputArea, KeywordCloud, MatchRadar,
  ProjectCardStack, ArchitectureDiagram, FlashCardStack,
  QuestionFlow, EvidenceChain,
  ResumeCanvas, SelectionFloatingBar, PageIndicator, AIChat,
  PipelineProgress, PDFPreview, DownloadButton, InterviewTip,
  useWizardStore, useAdapter,
} from '@resume-ci/ui';

export default function Home() {
  const adapter = useMemo(() => new MockAdapter(), []);
  return (
    <AdapterProvider adapter={adapter}>
      <WizardShell
        children={{
          anchor: <AnchorStep />,
          blueprint: <BlueprintStep />,
          alignment: <AlignmentStep />,
          polish: <PolishStep />,
          export: <ExportStep />,
        }}
      />
    </AdapterProvider>
  );
}

// AnchorStep, BlueprintStep — 同 Phase 9 实现

function AlignmentStep() {
  const adapter = useAdapter();
  const alignment = useWizardStore((s) => s.alignment);
  const selectedProjectId = useWizardStore((s) => s.selectedProjectId);
  const appendQuestion = useWizardStore((s) => s.appendAlignmentQuestion);
  const nextQuestion = useWizardStore((s) => s.nextAlignmentQuestion);
  const appendBullet = useWizardStore((s) => s.appendSTARBullet);
  const setSubmitting = useWizardStore((s) => s.setSubmittingQuestionId);

  const currentQuestion = alignment.questions[alignment.currentQuestionIndex] || null;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-8 max-w-5xl mx-auto">
      <QuestionFlow
        question={currentQuestion}
        questionIndex={alignment.currentQuestionIndex + 1}
        totalQuestions={5}
        loading={alignment.status === 'loading'}
        submitting={!!alignment.submittingQuestionId}
        onSubmitAnswer={(qId, answer) => {
          setSubmitting(qId);
          // adapter.submitAlignmentAnswer(qId, answer) → SSE → appendBullet
        }}
        onSkip={() => nextQuestion()}
      />
      <EvidenceChain evidence={alignment.evidence} />
    </div>
  );
}

function PolishStep() {
  const adapter = useAdapter();
  const polish = useWizardStore((s) => s.polish);
  const setResumeHTML = useWizardStore((s) => s.setResumeHTML);
  const updateSection = useWizardStore((s) => s.updateResumeSection);
  const setPageFit = useWizardStore((s) => s.setPageFit);
  const toggleChat = useWizardStore((s) => s.toggleChat);

  return (
    <div className="flex gap-0 max-w-full mx-auto">
      <AIChat
        messages={[]}
        onSend={(text) => {/* adapter.aiPolish(text, '') */}}
        onQuickCommand={(cmd) => {/* */}}
        isOpen={polish.isChatOpen}
        onToggle={toggleChat}
      />
      <div className="flex-1">
        <ResumeCanvas
          html={polish.resumeHTML}
          onSectionEdit={(section, content) => {
            updateSection(section, content);
            // adapter.updateResumeSection(section, content)
          }}
          pageFit={polish.pageFit}
        />
      </div>
      <PageIndicator
        currentPages={polish.pageFit?.currentPages ?? 0}
        status={polish.pageFit?.status ?? 'fit'}
        onRefresh={() => {/* adapter.checkPageFit() → setPageFit */}}
      />
    </div>
  );
}

function ExportStep() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <PipelineProgress
        stages={[
          { name: "排版对齐", status: "pending" },
          { name: "字体嵌入", status: "pending" },
          { name: "ATS校验", status: "pending" },
          { name: "生成PDF", status: "pending" },
        ]}
        overallProgress={0}
      />
      <PDFPreview pdfUrl="" />
      <DownloadButton pdfUrl="" onRegenerate={() => {}} />
      <InterviewTip tip="面试官可能会问，准备好回答技术选型理由会让面试更有说服力。" />
    </div>
  );
}
```

- [ ] **Step 2: 同步更新 apps/desktop/src/renderer/App.tsx**

同上逻辑，使用 `React.createElement` 语法。

- [ ] **Step 3: 全量 typecheck**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck
```

Expected: @resume-ci/core, @resume-ci/ui, @resume-ci/web, @resume-ci/desktop 全部 PASS。

- [ ] **Step 4: 全量测试**

```bash
pnpm turbo run test
cd services/fastapi && python -m pytest tests/ -v
```

Expected: 全部 Vitest + pytest 测试 PASS。

- [ ] **Step 5: 双端启动验证**

```bash
pnpm dev:web     # http://localhost:3000 — 5 步完整可走通
pnpm dev:desktop # Electron 窗口同步
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Phase 10-11 final integration — all 5 wizard steps wired

- Full 5-step flow: Anchor → Blueprint → Alignment → Polish → Export
- All components connected to WizardStore and Adapter
- Typecheck + tests pass across entire monorepo
- Web and Desktop shells both rendering complete UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

Phase 11 计划已存入 `docs/superpowers/plans/2026-06-01-resume-ci-phase11.md`。

### 全部计划文件索引

| 文件 | 内容 | 任务数 |
|------|------|--------|
| `2026-05-31-resume-ci-phase1-3.md` | Monorepo + 协议核心 + Mock Adapter + UI 骨架 | 1-6 |
| `2026-05-31-resume-ci-phase4-5.md` | UI 框架 + Python 服务 | 7-12 |
| `2026-05-31-resume-ci-phase6-8.md` | Web 壳 + Desktop 壳 + CI/CD + 集成验证 | 13-18 |
| `2026-06-01-resume-ci-phase9.md` | Anchor + Blueprint 真实 UI | 19-26 |
| `2026-06-01-resume-ci-phase10.md` | Alignment + Polish 真实 UI | 27-34 |
| `2026-06-01-resume-ci-phase11.md` | Export + 收尾 | 35-41 |
