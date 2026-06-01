# Resume CI 实现计划 — Phase 4-5: UI 组件 + Python 服务

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现共享 UI 组件库（Wizard 框架 + 5 步组件）和 FastAPI WebSocket 服务（封装 3 个 Python CLI）。

**Architecture:** `@resume-ci/ui` 通过 Zustand 驱动 5 步 Wizard，组件通过 `useAdapter()` hook 调用 `IResumeCIAdapter`。FastAPI 通过 `PipelineService` 封装 CLI 调用。

**Tech Stack:** React 19, Zustand 5, Tailwind CSS 4, Framer Motion 12, FastAPI, uvicorn, asyncio

---

### Task 7: 安装 UI 依赖 + Tailwind 配置

**Files:**
- Create: `packages/ui/src/styles/globals.css`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: 添加 UI 依赖**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
cd packages/ui
pnpm add zustand framer-motion
pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: 写 Tailwind 入口 CSS**

```css
/* packages/ui/src/styles/globals.css */
@import "tailwindcss";

:root {
  --accent: #2563eb;
  --accent-soft: #eaf1ff;
  --ink: #141414;
  --muted: #667085;
  --hairline: #dbe2ea;
  --panel: #f7f9fc;
  --screen-bg: #eef2f7;
}

body {
  background: var(--screen-bg);
  color: var(--ink);
  font-family: "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif;
}
```

- [ ] **Step 3: 确认 typecheck**

```bash
pnpm turbo run typecheck --filter=@resume-ci/ui
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): add tailwindcss + zustand + framer-motion deps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: 实现 useWizardStore（Zustand 全局状态）

**Files:**
- Create: `packages/ui/src/wizard/useWizardStore.ts`
- Create: `packages/ui/src/wizard/useWizardStore.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// packages/ui/src/wizard/useWizardStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWizardStore } from './useWizardStore';

describe('useWizardStore', () => {
  beforeEach(() => {
    useWizardStore.setState(useWizardStore.getInitialState());
  });

  it('starts at anchor step', () => {
    const { step } = useWizardStore.getState();
    expect(step).toBe('anchor');
  });

  it('setJD moves to blueprint', () => {
    const jd = { keywords: [], techStack: [], roleType: 'backend', matchProfile: { score: 0.9, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    const state = useWizardStore.getState();
    expect(state.jd).toEqual(jd);
    expect(state.step).toBe('blueprint');
  });

  it('setJD triggers automatic step advance', () => {
    const jd = { keywords: [], techStack: ['Go'], roleType: 'backend', matchProfile: { score: 0.8, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    expect(useWizardStore.getState().step).toBe('blueprint');
    expect(useWizardStore.getState().visitedSteps.has('blueprint')).toBe(true);
  });

  it('selectProject advances to alignment', () => {
    useWizardStore.getState().selectProject({ id: 'p1', title: 'Test' });
    const state = useWizardStore.getState();
    expect(state.selectedProject).toEqual({ id: 'p1', title: 'Test' });
  });

  it('goBack returns to previous step', () => {
    const jd = { keywords: [], techStack: [], roleType: 'frontend', matchProfile: { score: 1, gaps: [] } };
    useWizardStore.getState().setJD(jd);
    expect(useWizardStore.getState().step).toBe('blueprint');
    useWizardStore.getState().goBack();
    expect(useWizardStore.getState().step).toBe('anchor');
  });

  it('goBack from anchor is no-op', () => {
    useWizardStore.getState().goBack();
    expect(useWizardStore.getState().step).toBe('anchor');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: FAIL

- [ ] **Step 3: 实现 store**

```typescript
// packages/ui/src/wizard/useWizardStore.ts
import { create } from 'zustand';
import type { WizardStep, WizardState, JDParsed } from './WizardState';

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

interface WizardActions {
  setJD: (jd: JDParsed) => void;
  selectProject: (project: WizardState['selectedProject']) => void;
  setResumeHTML: (html: string) => void;
  goBack: () => void;
  goToStep: (step: WizardStep) => void;
  getInitialState: () => WizardState & WizardActions;
}

export const useWizardStore = create<WizardState & WizardActions>((set, get) => ({
  // ─── State ───
  step: 'anchor',
  jd: null,
  selectedProject: null,
  resumeHTML: null,
  visitedSteps: new Set(['anchor']),

  // ─── Actions ───
  setJD: (jd: JDParsed) => {
    const visited = new Set(get().visitedSteps);
    visited.add('blueprint');
    set({ jd, step: 'blueprint', visitedSteps: visited });
  },

  selectProject: (project) => {
    const visited = new Set(get().visitedSteps);
    visited.add('alignment');
    set({ selectedProject: project, step: 'alignment', visitedSteps: visited });
  },

  setResumeHTML: (html: string) => {
    set({ resumeHTML: html });
  },

  goBack: () => {
    const currentIdx = STEP_ORDER.indexOf(get().step);
    if (currentIdx <= 0) return;
    set({ step: STEP_ORDER[currentIdx - 1] });
  },

  goToStep: (target: WizardStep) => {
    const visited = get().visitedSteps;
    if (!visited.has(target)) return;  // 只能回退到已访问步骤
    set({ step: target });
  },

  getInitialState: () => ({
    step: 'anchor',
    jd: null,
    selectedProject: null,
    resumeHTML: null,
    visitedSteps: new Set(['anchor']),
    setJD: () => {},
    selectProject: () => {},
    setResumeHTML: () => {},
    goBack: () => {},
    goToStep: () => {},
    getInitialState: () => ({} as WizardState & WizardActions),
  }),
}));
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add Zustand wizard store with step flow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: 实现 useAdapter hook + React Context

**Files:**
- Create: `packages/ui/src/adapter/AdapterContext.tsx`
- Create: `packages/ui/src/adapter/useAdapter.ts`
- Create: `packages/ui/src/adapter/useAdapter.test.tsx`

- [ ] **Step 1: 写测试**

```typescript
// packages/ui/src/adapter/useAdapter.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AdapterProvider } from './AdapterContext';
import { useAdapter } from './useAdapter';
import { MockAdapter } from '@resume-ci/core';
import React from 'react';

describe('useAdapter', () => {
  it('returns adapter from context', () => {
    const mock = new MockAdapter();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AdapterProvider, { adapter: mock }, children);
    
    const { result } = renderHook(() => useAdapter(), { wrapper });
    expect(result.current).toBe(mock);
  });

  it('throws if no provider', () => {
    expect(() => renderHook(() => useAdapter())).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**（需要先安装 @testing-library/react）

```bash
cd packages/ui
pnpm add -D @testing-library/react @testing-library/jest-dom jsdom
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: FAIL

- [ ] **Step 3: 实现 AdapterContext**

```typescript
// packages/ui/src/adapter/AdapterContext.tsx
import React, { createContext, useContext } from 'react';
import type { IResumeCIAdapter } from '@resume-ci/core';

const AdapterContext = createContext<IResumeCIAdapter | null>(null);

export function AdapterProvider({
  adapter,
  children,
}: {
  adapter: IResumeCIAdapter;
  children: React.ReactNode;
}) {
  return React.createElement(AdapterContext.Provider, { value: adapter }, children);
}

export function useAdapterContext(): IResumeCIAdapter {
  const ctx = useContext(AdapterContext);
  if (!ctx) throw new Error('useAdapter must be used within AdapterProvider');
  return ctx;
}
```

```typescript
// packages/ui/src/adapter/useAdapter.ts
import { useAdapterContext } from './AdapterContext';

export function useAdapter() {
  return useAdapterContext();
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): add AdapterProvider context + useAdapter hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: 实现 WizardShell + 共享 UI 组件

**Files:**
- Create: `packages/ui/src/wizard/WizardShell.tsx`
- Create: `packages/ui/src/shared/WizardProgress.tsx`
- Create: `packages/ui/src/shared/SplitPane.tsx`
- Create: `packages/ui/src/shared/TypewriterText.tsx`

- [ ] **Step 1: 写 WizardProgress**

```typescript
// packages/ui/src/shared/WizardProgress.tsx
import React from 'react';
import type { WizardStep } from '../wizard/WizardState';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'anchor', label: 'JD 锚点' },
  { key: 'blueprint', label: '项目蓝图' },
  { key: 'alignment', label: '证据对齐' },
  { key: 'polish', label: '沉浸精修' },
  { key: 'export', label: '导出 PDF' },
];

export function WizardProgress({
  current,
  visited,
  onStepClick,
}: {
  current: WizardStep;
  visited: Set<WizardStep>;
  onStepClick: (step: WizardStep) => void;
}) {
  return React.createElement(
    'nav',
    { className: 'flex items-center justify-center gap-2 py-4 px-6' },
    ...STEPS.map((s, i) => {
      const isCurrent = s.key === current;
      const isDone = visited.has(s.key) && !isCurrent;
      const clickable = visited.has(s.key);

      return React.createElement(
        'button',
        {
          key: s.key,
          onClick: () => clickable && onStepClick(s.key),
          disabled: !clickable,
          className: `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${isCurrent ? 'bg-blue-600 text-white' : ''}
            ${isDone ? 'bg-green-100 text-green-800' : ''}
            ${!isCurrent && !isDone ? 'bg-slate-100 text-slate-400' : ''}
            ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`,
        },
        React.createElement('span', { className: 'w-6 h-6 rounded-full flex items-center justify-center text-xs border' }, i + 1),
        React.createElement('span', null, s.label),
      );
    }),
  );
}
```

- [ ] **Step 2: 写 SplitPane**

```typescript
// packages/ui/src/shared/SplitPane.tsx
import React, { useRef, useState, useCallback } from 'react';

export function SplitPane({
  left,
  right,
  defaultLeftPercent = 40,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
}) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const onMouseMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.max(20, Math.min(80, pct)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return React.createElement(
    'div',
    { ref: containerRef, className: 'flex h-full' },
    React.createElement('div', { style: { width: `${leftPercent}%` }, className: 'overflow-auto p-4' }, left),
    React.createElement('div', {
      onMouseDown,
      className: 'w-1.5 bg-slate-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors',
    }),
    React.createElement('div', { style: { width: `${100 - leftPercent}%` }, className: 'overflow-auto p-4' }, right),
  );
}
```

- [ ] **Step 3: 写 TypewriterText**

```typescript
// packages/ui/src/shared/TypewriterText.tsx
import React, { useState, useEffect } from 'react';

export function TypewriterText({
  text,
  speed = 30,
  onDone,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onDone]);

  return React.createElement('span', null, displayed);
}
```

- [ ] **Step 4: 写 WizardShell**

```typescript
// packages/ui/src/wizard/WizardShell.tsx
import React from 'react';
import { useWizardStore } from './useWizardStore';
import { WizardProgress } from '../shared/WizardProgress';
import type { WizardStep } from './WizardState';

export function WizardShell({
  children,
}: {
  children: Record<WizardStep, React.ReactNode>;
}) {
  const step = useWizardStore((s) => s.step);
  const visitedSteps = useWizardStore((s) => s.visitedSteps);
  const goToStep = useWizardStore((s) => s.goToStep);
  const goBack = useWizardStore((s) => s.goBack);

  return React.createElement(
    'div',
    { className: 'min-h-screen flex flex-col' },
    React.createElement(WizardProgress, { current: step, visited: visitedSteps, onStepClick: goToStep }),
    React.createElement('main', { className: 'flex-1' }, children[step]),
    React.createElement(
      'footer',
      { className: 'flex justify-between px-6 py-3 border-t border-slate-200' },
      React.createElement(
        'button',
        { onClick: goBack, disabled: step === 'anchor', className: 'px-4 py-2 rounded-lg bg-slate-100 disabled:opacity-30' },
        '← 上一步',
      ),
    ),
  );
}
```

- [ ] **Step 5: typecheck 验证**

```bash
pnpm turbo run typecheck --filter=@resume-ci/ui
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add WizardShell + shared components (Progress, SplitPane, Typewriter)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: 创建 FastAPI 服务骨架

**Files:**
- Create: `services/fastapi/requirements.txt`
- Create: `services/fastapi/app/__init__.py`
- Create: `services/fastapi/app/main.py`
- Create: `services/fastapi/app/routers/__init__.py`
- Create: `services/fastapi/app/routers/ws.py`
- Create: `services/fastapi/app/services/__init__.py`
- Create: `services/fastapi/app/services/pipeline.py`
- Create: `services/fastapi/tests/__init__.py`
- Create: `services/fastapi/tests/test_pipeline.py`

- [ ] **Step 1: 写 requirements.txt**

```
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
pydantic>=2.10.0
websockets>=14.0
```

- [ ] **Step 2: 写 FastAPI 入口**

```python
# services/fastapi/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.ws import router as ws_router

app = FastAPI(title="Resume CI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://resume-ci.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router, prefix="/ws")
```

- [ ] **Step 3: 写 WebSocket handler**

```python
# services/fastapi/app/routers/ws.py
import json
import asyncio
from fastapi import APIRouter, WebSocket
from app.services.pipeline import PipelineService

router = APIRouter()
pipeline = PipelineService()

# 活跃任务追踪（用于 cancel）
active_tasks: dict[str, asyncio.Task] = {}
active_procs: dict[str, asyncio.subprocess.Process] = {}

@router.websocket("/")
async def ws_handler(ws: WebSocket):
    await ws.accept()
    
    async for raw in ws.iter_text():
        msg = json.loads(raw)
        
        if msg.get("type") == "cancel":
            cmd_id = msg["id"]
            
            # cancel asyncio task
            task = active_tasks.pop(cmd_id, None)
            if task and not task.done():
                task.cancel()
            
            # kill subprocess
            proc = active_procs.pop(cmd_id, None)
            if proc and proc.returncode is None:
                try:
                    proc.terminate()
                    await asyncio.wait_for(proc.wait(), timeout=3)
                except asyncio.TimeoutError:
                    proc.kill()
            
            await ws.send_json({"type": "done", "id": cmd_id, "result": {"cancelled": True}})
            continue
        
        if msg.get("type") != "cmd":
            continue
        
        cmd_id = msg["id"]
        method = msg["method"]
        params = msg.get("params", {})
        
        await ws.send_json({"type": "ack", "id": cmd_id})
        
        task = asyncio.create_task(execute_method(cmd_id, method, params, ws))
        active_tasks[cmd_id] = task


async def execute_method(cmd_id: str, method: str, params: dict, ws: WebSocket):
    try:
        handler = getattr(pipeline, method.replace(".", "_"))
        result = handler(**params)
        
        if hasattr(result, "__aiter__"):
            # 流式方法：逐 chunk 推送
            aggregated = []
            async for chunk in result:
                aggregated.append(chunk)
                await ws.send_json({"type": "chunk", "id": cmd_id, "data": chunk, "seq": len(aggregated) - 1})
            final = _aggregate(method, aggregated)
            await ws.send_json({"type": "done", "id": cmd_id, "result": final})
        else:
            awaited = await result if asyncio.iscoroutine(result) else result
            await ws.send_json({"type": "done", "id": cmd_id, "result": awaited})
    
    except asyncio.CancelledError:
        pass  # cancel 分支已发 done 消息
    except Exception as e:
        await ws.send_json({"type": "err", "id": cmd_id, "code": "INTERNAL", "message": str(e)})
    finally:
        active_tasks.pop(cmd_id, None)
        active_procs.pop(cmd_id, None)


def _aggregate(method: str, chunks: list) -> dict:
    if not chunks:
        return None
    if all(isinstance(c, str) for c in chunks):
        return {"text": "".join(chunks)}
    if all(isinstance(c, dict) for c in chunks):
        return {"items": chunks}
    return {"raw": chunks}
```

- [ ] **Step 4: 写 PipelineService skeleton**

```python
# services/fastapi/app/services/pipeline.py
import asyncio

class PipelineService:
    """封装 3 个 Python CLI 的调用。当前为 skeleton，后续 Task 填充真实 CLI 调用。"""
    
    async def jd_parse(self, raw: str) -> dict:
        """解析 JD 文本 → 结构化返回"""
        return {
            "keywords": [
                {"word": "React", "weight": 0.9},
                {"word": "TypeScript", "weight": 0.85},
            ],
            "techStack": ["React", "TypeScript", "Node.js"],
            "roleType": "frontend",
            "matchProfile": {"score": 0.88, "gaps": []},
        }
    
    async def project_discover(self, jd: dict) -> dict:
        """TODO: 调用 shushu-candidate-score CLI"""
        return {"cards": []}
    
    async def resume_get(self) -> dict:
        """TODO: 返回当前简历 HTML"""
        return {"html": ""}
    
    async def resume_polish(self, text: str, style: str) -> str:
        """TODO: 调用 LLM 润色"""
        return f"[润色] {text}"
    
    async def export_pdf(self) -> dict:
        """TODO: 调用 vibe-resume 导出"""
        return {"url": ""}
```

- [ ] **Step 5: 写 Python 测试**

```python
# services/fastapi/tests/test_pipeline.py
import pytest
from app.services.pipeline import PipelineService

def test_jd_parse_returns_structured_data():
    service = PipelineService()
    result = service.jd_parse("需要熟悉 React")
    # 同步方法直接返回 dict
    assert "keywords" in result
    assert "techStack" in result
    assert result["roleType"] == "frontend"
```

- [ ] **Step 6: 跑 Python 测试**

```bash
cd services/fastapi
pip install -r requirements.txt
pip install pytest
python -m pytest tests/ -v
```

Expected: 1 test PASS

- [ ] **Step 7: 验证 FastAPI 可启动**

```bash
cd services/fastapi
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl http://localhost:8000/docs
```

Expected: OpenAPI docs 返回 200

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(fastapi): scaffold WebSocket handler + PipelineService skeleton

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: 接入 vibe-resume CLI → export_pdf

**Files:**
- Create: `scripts/vibe-resume/` (symlink or copy from `../vibe-resume/`)
- Modify: `services/fastapi/app/services/pipeline.py`

- [ ] **Step 1: 链接 vibe-resume 源码**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
mkdir -p scripts
# 复制或符号链接（Windows 上用 junction 或直接 copy）
cp -r ../vibe-resume scripts/vibe-resume
```

- [ ] **Step 2: 在 PipelineService 中实现 export_pdf**

```python
# 追加到 services/fastapi/app/services/pipeline.py

import asyncio
import subprocess
from pathlib import Path

class PipelineService:
    # ... 已有方法 ...
    
    async def export_pdf(self) -> dict:
        """调用 vibe-resume 的 export-pdf.mjs 脚本"""
        vibe_resume_dir = Path(__file__).resolve().parent.parent.parent.parent.parent / "scripts" / "vibe-resume"
        
        proc = await asyncio.create_subprocess_exec(
            "node", "scripts/export-pdf.mjs", "export/resume-output.pdf",
            cwd=str(vibe_resume_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            raise RuntimeError(f"PDF export failed: {stderr.decode()}")
        
        output_pdf = vibe_resume_dir / "export" / "resume-output.pdf"
        return {
            "url": f"/exports/resume-output.pdf",
            "path": str(output_pdf),
            "exists": output_pdf.exists(),
        }
```

- [ ] **Step 3: 跑测试验证**

```bash
cd services/fastapi
python -m pytest tests/ -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(fastapi): wire vibe-resume PDF export into pipeline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

此计划 Phase 4-5 已存入 `docs/superpowers/plans/2026-05-31-resume-ci-phase4-5.md`。
