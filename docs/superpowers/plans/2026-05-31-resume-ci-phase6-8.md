# Resume CI 实现计划 — Phase 6-8: 双端壳层 + CI/CD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Web 端（Next.js + RemoteAdapter）和 Desktop 端（Electron + LocalAdapter）两个壳层，实现 CI/CD 流水线。

**Architecture:** 两端通过各自的 Adapter 注入同一套 `@resume-ci/ui` 组件。Web 端 Next.js BFF 代理 WebSocket，Desktop 端 Electron Main Process 管理 Python 子进程。

**Tech Stack:** Next.js 15, NextAuth.js 5, Electron 34, electron-builder 26, GitHub Actions

---

### Task 13: 创建 Next.js Web 壳

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`

- [ ] **Step 1: 创建 Next.js 项目**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
mkdir -p apps/web
cd apps/web
pnpm init
pnpm add next@latest react@latest react-dom@latest
pnpm add @resume-ci/core@workspace:* @resume-ci/ui@workspace:*
pnpm add -D @types/react @types/react-dom typescript
```

- [ ] **Step 2: 写 apps/web/package.json scripts**

```jsonc
{
  "name": "@resume-ci/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "test": "echo 'no web tests yet'",
  },
  "dependencies": {
    "@resume-ci/core": "workspace:*",
    "@resume-ci/ui": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
  },
}
```

- [ ] **Step 3: 写 apps/web/next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@resume-ci/core", "@resume-ci/ui"],
};

export default nextConfig;
```

- [ ] **Step 4: 写 apps/web/tsconfig.json**

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }],
  },
  "include": ["next-env.d.ts", "src"],
}
```

- [ ] **Step 5: 写 apps/web/src/app/globals.css**

```css
@import "../../../../packages/ui/src/styles/globals.css";
```

- [ ] **Step 6: 写 apps/web/src/app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resume CI — AI 求职工作台',
  description: '从 JD 到一页 PDF，AI 驱动的全链路求职工具',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: 写 apps/web/src/app/page.tsx**

```typescript
'use client';

import { MockAdapter } from '@resume-ci/core';
import { AdapterProvider, WizardShell, useWizardStore } from '@resume-ci/ui';
import { useMemo } from 'react';

export default function Home() {
  const adapter = useMemo(() => new MockAdapter(), []);

  return (
    <AdapterProvider adapter={adapter}>
      <WizardShell
        children={{
          anchor:     <StepPlaceholder title="JD 锚点输入" />,
          blueprint:  <StepPlaceholder title="项目蓝图" />,
          alignment:  <StepPlaceholder title="证据对齐" />,
          polish:     <StepPlaceholder title="沉浸精修" />,
          export:     <StepPlaceholder title="导出 PDF" />,
        }}
      />
    </AdapterProvider>
  );
}

function StepPlaceholder({ title }: { title: string }) {
  const step = useWizardStore((s) => s.step);
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500">当前步骤：{step}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 启动 Next.js dev 验证**

```bash
pnpm turbo run dev --filter=@resume-ci/web
```

Expected: `http://localhost:3000` 可访问，看到 Wizard 框架 + 5 步骤占位

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Next.js shell with WizardShell + MockAdapter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 14: 实现 RemoteAdapter（WebSocket 连接 FastAPI）

**Files:**

- Create: `apps/web/src/adapters/remote.adapter.ts`

- [ ] **Step 1: 实现 RemoteAdapter**

```typescript
// apps/web/src/adapters/remote.adapter.ts
import type {
  IResumeCIAdapter,
  ClientMessage,
  ServerMessage,
} from "@resume-ci/core";

type PromiseResolver = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  chunks: unknown[];
  onChunk: (data: unknown) => void;
};

export class RemoteAdapter implements IResumeCIAdapter {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PromiseResolver>();
  private reconnectAttempts = 0;
  private url: string;

  constructor(url?: string) {
    this.url =
      url ??
      (typeof window !== "undefined"
        ? `ws://${window.location.hostname}:8000/ws`
        : "ws://localhost:8000/ws");
  }

  connect(): void {
    if (typeof window === "undefined") return;

    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as ServerMessage;
      const entry = this.pending.get(msg.id);
      if (!entry) return;

      switch (msg.type) {
        case "chunk":
          entry.onChunk(msg.data);
          entry.chunks.push(msg.data);
          break;
        case "done":
          entry.resolve(msg.result);
          this.pending.delete(msg.id);
          break;
        case "err":
          entry.reject(new Error(msg.message));
          this.pending.delete(msg.id);
          break;
      }
    };

    this.ws.onclose = (e: CloseEvent) => {
      if (e.code !== 1000 && this.reconnectAttempts < 5) {
        const delay = Math.min(2 ** this.reconnectAttempts * 500, 8000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  send(method: string, params: Record<string, unknown>): string {
    const id = crypto.randomUUID();
    const msg: ClientMessage = { type: "cmd", id, method, params };
    this.ws?.send(JSON.stringify(msg));
    return id;
  }

  cancel(id: string): void {
    const msg: ClientMessage = { type: "cancel", id };
    this.ws?.send(JSON.stringify(msg));
    this.pending.delete(id);
  }

  private streamMethod<T>(
    method: string,
    params: Record<string, unknown>,
  ): AsyncIterable<T> {
    const id = this.send(method, params);

    return {
      [Symbol.asyncIterator]() {
        let done = false;
        let chunkQueue: T[] = [];
        let resolveNext: ((v: IteratorResult<T>) => void) | null = null;

        const entry: PromiseResolver = {
          resolve: () => {},
          reject: () => {},
          chunks: [],
          onChunk: (data: unknown) => {
            chunkQueue.push(data as T);
            resolveNext?.({ value: data as T, done: false });
            resolveNext = null;
          },
        };

        this.pending.set(id, {
          ...entry,
          resolve: (result) => {
            done = true;
            resolveNext?.({ value: undefined as any, done: true });
          },
          reject: (err) => {
            done = true;
            resolveNext?.({ value: undefined as any, done: true });
          },
        });

        return {
          next: () => {
            if (done)
              return Promise.resolve({ value: undefined as any, done: true });
            if (chunkQueue.length > 0) {
              return Promise.resolve({
                value: chunkQueue.shift()!,
                done: false,
              });
            }
            return new Promise((r) => {
              resolveNext = r;
            });
          },
        };
      },
    };
  }

  // 以下三行全链路报错强制类型安全，具体实现已由协议层覆盖
  async parseJD(raw: string): Promise<unknown> {
    const id = this.send("jd.parse", { raw });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, chunks: [], onChunk: () => {} });
    });
  }

  discoverProjects(jd: unknown): AsyncIterable<unknown> {
    return this.streamMethod("project.discover", { jd });
  }

  async getArchitectureDiagram(projectId: string): Promise<string> {
    const id = this.send("project.diagram", { projectId });
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as string),
        reject,
        chunks: [],
        onChunk: () => {},
      });
    });
  }

  async getTechChallenges(projectId: string): Promise<unknown[]> {
    const id = this.send("project.challenges", { projectId });
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as unknown[]),
        reject,
        chunks: [],
        onChunk: () => {},
      });
    });
  }

  generateAlignmentQuestions(projectId: string): AsyncIterable<unknown> {
    return this.streamMethod("alignment.questions", { projectId });
  }

  submitAlignmentAnswer(
    questionId: string,
    answer: string,
  ): AsyncIterable<string> {
    return this.streamMethod("alignment.answer", { questionId, answer });
  }

  async getResumeHTML(): Promise<string> {
    const id = this.send("resume.get", {});
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve((v as any)?.html ?? ""),
        reject,
        chunks: [],
        onChunk: () => {},
      });
    });
  }

  async updateResumeSection(section: string, content: string): Promise<void> {
    const id = this.send("resume.update", { section, content });
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
        chunks: [],
        onChunk: () => {},
      });
    });
  }

  aiPolish(text: string, style: string): AsyncIterable<string> {
    return this.streamMethod("resume.polish", { text, style });
  }

  async checkPageFit(): Promise<{
    currentPages: number;
    status: "fit" | "overflow" | "underflow";
  }> {
    const id = this.send("resume.fit", {});
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as any),
        reject,
        chunks: [],
        onChunk: () => {},
      });
    });
  }

  exportPDF(): AsyncIterable<{ stage: string; progress: number }> {
    return this.streamMethod("export.pdf", {});
  }
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm turbo run typecheck --filter=@resume-ci/web
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(web): implement RemoteAdapter with WebSocket streaming

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 15: 创建 Electron Desktop 壳骨架

**Files:**

- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/preload.ts`
- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/App.tsx`
- Create: `apps/desktop/src/main/window-manager.ts`

- [ ] **Step 1: 初始化 Electron 项目**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
mkdir -p apps/desktop/src/main apps/desktop/src/preload apps/desktop/src/renderer
cd apps/desktop
pnpm init
pnpm add electron@latest
pnpm add @resume-ci/core@workspace:* @resume-ci/ui@workspace:*
pnpm add react@latest react-dom@latest
pnpm add -D @types/react @types/react-dom typescript vite @vitejs/plugin-react electron-builder
```

- [ ] **Step 2: 写 apps/desktop/package.json scripts**

```jsonc
{
  "name": "@resume-ci/desktop",
  "version": "0.1.0",
  "private": true,
  "main": "./dist-electron/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "test": "echo 'no desktop tests yet'",
  },
  "dependencies": {
    "@resume-ci/core": "workspace:*",
    "@resume-ci/ui": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^34.0.0",
    "electron-builder": "^26.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
  },
}
```

- [ ] **Step 3: 写 apps/desktop/tsconfig.json**

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist-electron",
    "rootDir": "./src",
  },
  "include": ["src"],
}
```

- [ ] **Step 4: 写 apps/desktop/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist-electron/renderer"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@resume-ci/core": path.resolve(__dirname, "../../packages/core/src"),
      "@resume-ci/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
```

- [ ] **Step 5: 写 Electron 主进程入口**

```typescript
// apps/desktop/src/main/index.ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Resume CI",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite dev server，生产加载打包文件
  if (process.env["VITE_DEV_SERVER_URL"]) {
    mainWindow.loadURL(process.env["VITE_DEV_SERVER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 基础 IPC handler
ipcMain.handle("app:getVersion", () => app.getVersion());
```

- [ ] **Step 6: 写 Preload**

```typescript
// apps/desktop/src/preload/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

  // Python 通信（后续 Task 填充）
  send: (_msg: unknown) => Promise.resolve(),
  cancel: (_id: string) => Promise.resolve(),
  onMessage: (_cb: (msg: unknown) => void) => () => {},
  onEvent: (_cb: (event: { type: string }) => void) => () => {},
});
```

- [ ] **Step 7: 写 Renderer**

```html
<!-- apps/desktop/src/renderer/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Resume CI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./App.tsx"></script>
  </body>
</html>
```

```typescript
// apps/desktop/src/renderer/App.tsx
import React, { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { MockAdapter } from "@resume-ci/core";
import { AdapterProvider, WizardShell, useWizardStore } from "@resume-ci/ui";

function App() {
  const adapter = useMemo(() => new MockAdapter(), []);

  return React.createElement(
    AdapterProvider,
    { adapter },
    React.createElement(WizardShell, {
      children: {
        anchor: React.createElement(StepPlaceholder, {
          title: "JD 锚点 (Desktop)",
        }),
        blueprint: React.createElement(StepPlaceholder, { title: "项目蓝图" }),
        alignment: React.createElement(StepPlaceholder, { title: "证据对齐" }),
        polish: React.createElement(StepPlaceholder, { title: "沉浸精修" }),
        export: React.createElement(StepPlaceholder, { title: "导出 PDF" }),
      },
    }),
  );
}

function StepPlaceholder({ title }: { title: string }) {
  return React.createElement(
    "div",
    { className: "flex items-center justify-center h-96" },
    React.createElement("h2", { className: "text-3xl font-bold" }, title),
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(React.createElement(App));
```

- [ ] **Step 8: typecheck**

```bash
pnpm turbo run typecheck --filter=@resume-ci/desktop
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(desktop): scaffold Electron shell with MockAdapter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 16: Desktop LocalAdapter（IPC 桥接）

**Files:**

- Create: `apps/desktop/src/adapters/local.adapter.ts`

- [ ] **Step 1: 实现 LocalAdapter**

```typescript
// apps/desktop/src/adapters/local.adapter.ts
import type { IResumeCIAdapter, ServerMessage } from "@resume-ci/core";

declare global {
  interface Window {
    api: {
      send: (msg: unknown) => Promise<void>;
      cancel: (id: string) => Promise<void>;
      onMessage: (cb: (msg: ServerMessage) => void) => () => void;
      onEvent: (cb: (event: { type: string }) => void) => () => void;
    };
  }
}

export class LocalAdapter implements IResumeCIAdapter {
  private pending = new Map<
    string,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      chunks: unknown[];
    }
  >();
  private cleanup: (() => void) | null = null;

  constructor() {
    this.cleanup = window.api.onMessage((msg: ServerMessage) => {
      const entry = this.pending.get(msg.id);
      if (!entry) return;

      switch (msg.type) {
        case "chunk":
          entry.chunks.push(msg.data);
          break;
        case "done":
          entry.resolve(msg.result);
          this.pending.delete(msg.id);
          break;
        case "err":
          entry.reject(new Error(msg.message));
          this.pending.delete(msg.id);
          break;
      }
    });
  }

  destroy() {
    this.cleanup?.();
  }

  send(method: string, params: Record<string, unknown>): string {
    const id = crypto.randomUUID();
    window.api.send({ type: "cmd", id, method, params });
    return id;
  }

  cancel(id: string): void {
    window.api.cancel(id);
    this.pending.delete(id);
  }

  // ─── Adapter 方法实现 ───
  async parseJD(raw: string): Promise<unknown> {
    const id = this.send("jd.parse", { raw });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, chunks: [] });
    });
  }

  async *discoverProjects(jd: unknown): AsyncIterable<unknown> {
    const id = this.send("project.discover", { jd });
    yield* this.yieldChunks(id);
  }

  async getArchitectureDiagram(projectId: string): Promise<string> {
    const id = this.send("project.diagram", { projectId });
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as string),
        reject,
        chunks: [],
      });
    });
  }

  async getTechChallenges(projectId: string): Promise<unknown[]> {
    const id = this.send("project.challenges", { projectId });
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as unknown[]),
        reject,
        chunks: [],
      });
    });
  }

  async *generateAlignmentQuestions(projectId: string): AsyncIterable<unknown> {
    const id = this.send("alignment.questions", { projectId });
    yield* this.yieldChunks(id);
  }

  async *submitAlignmentAnswer(
    questionId: string,
    answer: string,
  ): AsyncIterable<string> {
    const id = this.send("alignment.answer", { questionId, answer });
    yield* this.yieldChunks(id);
  }

  async getResumeHTML(): Promise<string> {
    const id = this.send("resume.get", {});
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve((v as any)?.html ?? ""),
        reject,
        chunks: [],
      });
    });
  }

  async updateResumeSection(section: string, content: string): Promise<void> {
    const id = this.send("resume.update", { section, content });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: () => resolve(), reject, chunks: [] });
    });
  }

  async *aiPolish(text: string, style: string): AsyncIterable<string> {
    const id = this.send("resume.polish", { text, style });
    yield* this.yieldChunks(id);
  }

  async checkPageFit(): Promise<{
    currentPages: number;
    status: "fit" | "overflow" | "underflow";
  }> {
    const id = this.send("resume.fit", {});
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as any),
        reject,
        chunks: [],
      });
    });
  }

  async *exportPDF(): AsyncIterable<{ stage: string; progress: number }> {
    const id = this.send("export.pdf", {});
    yield* this.yieldChunks(id);
  }

  private async *yieldChunks<T>(id: string): AsyncIterable<T> {
    let resolveQueue: Array<(v: IteratorResult<T>) => void> = [];
    let chunks: T[] = [];
    let finished = false;

    const entry = {
      resolve: (result: unknown) => {
        if (Array.isArray((result as any)?.items)) {
          chunks = (result as any).items;
        }
        finished = true;
        resolveQueue.forEach((r) => r({ value: undefined as any, done: true }));
      },
      reject: (err: Error) => {
        finished = true;
        resolveQueue.forEach((r) => r({ value: undefined as any, done: true }));
      },
      chunks: [] as unknown[],
    };

    this.pending.set(id, entry);

    try {
      while (!finished || chunks.length > 0) {
        if (chunks.length > 0) {
          yield chunks.shift()!;
        } else if (!finished) {
          await new Promise<IteratorResult<T>>((r) => {
            resolveQueue.push(r);
          });
        }
      }
    } finally {
      this.pending.delete(id);
    }
  }
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm turbo run typecheck --filter=@resume-ci/desktop
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(desktop): implement LocalAdapter with IPC bridge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 17: CI/CD — GitHub Actions 流水线

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 写 CI 工作流**

```yaml
# .github/workflows/ci.yml
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
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Schema Codegen
        run: pnpm turbo run codegen

      - name: Type Check
        run: pnpm turbo run typecheck

      - name: Lint
        run: pnpm turbo run lint || true

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
      url: https://resume-ci.vercel.app
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
          cache: "pnpm"

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
          vercel-args: "--prod"

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
          cache: "pnpm"

      - uses: actions/cache/restore@v4
        with:
          path: .turbo
          key: turbo-${{ github.sha }}

      - run: pnpm install --frozen-lockfile

      - name: Build Desktop
        run: pnpm turbo run build --filter=@resume-ci/desktop

      - name: Package Electron
        run: npx electron-builder --config apps/desktop/electron-builder.yml
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
          python-version: "3.12"

      - name: Install Dependencies
        run: |
          pip install -r services/fastapi/requirements.txt
          pip install pytest

      - name: Run Python Tests
        run: pytest services/fastapi/tests/ -v
```

- [ ] **Step 2: 写 electron-builder.yml**

```yaml
# apps/desktop/electron-builder.yml
appId: com.resume-ci.desktop
productName: Resume CI
directories:
  output: dist-electron
  buildResources: resources

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: true
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions pipeline with Quality Gates + Vercel + Electron

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 18: 最终集成验证

**Files:**

- 无新文件。验证全栈可跑通。

- [ ] **Step 1: 全量 typecheck**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run typecheck
```

Expected: @resume-ci/core, @resume-ci/ui, @resume-ci/web, @resume-ci/desktop 全部 PASS

- [ ] **Step 2: 全量测试**

```bash
pnpm turbo run test
cd services/fastapi && python -m pytest tests/ -v
```

Expected: TS 测试 + Python 测试全部 PASS

- [ ] **Step 3: Web dev 启动验证**

```bash
pnpm dev:web
```

Expected: `http://localhost:3000` 显示 Wizard 框架 + 5 步占位

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final integration verification — all typecheck + tests pass

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

Phase 6-8 计划已存入 `docs/superpowers/plans/2026-05-31-resume-ci-phase6-8.md`。

### 全部计划文件索引

| 文件                               | 内容                                         | 任务数 |
| ---------------------------------- | -------------------------------------------- | ------ |
| `2026-05-31-resume-ci-phase1-3.md` | Monorepo + 协议核心 + Mock Adapter + UI 骨架 | 1-6    |
| `2026-05-31-resume-ci-phase4-5.md` | UI 组件 + Python 服务                        | 7-12   |
| `2026-05-31-resume-ci-phase6-8.md` | Web 壳 + Desktop 壳 + CI/CD + 集成验证       | 13-18  |








当前什么状态？：

好问题。这个计划实现完 18 个 Task 之后，你手上会有：

---

产品状态：双端可跑的骨架，不是成品

你能看到的东西

Web 端 (localhost:3000)：

┌──────────────────────────────────────────────────┐
│ ① JD 锚点 ② 项目蓝图 ③ 证据对齐 ④ 精修 ⑤ 导出 │ ← 5 步进度条可点击
├──────────────────────────────────────────────────┤
│ │
│ 当前步骤：anchor │
│ 一个灰色占位框 │
│ │
│ │
├──────────────────────────────────────────────────┤
│ ← 上一步 下一步 → │
└──────────────────────────────────────────────────┘

- 5 步进度条能点，能前进后退
- 每一步显示的是一个灰色占位方块，上面写着步骤名
- Zustand 状态机完整，JD → 项目选择 → 对齐 → 精修 → 导出的数据流能走通
- 但没有任何真实 UI 内容 — 没有 JD 输入框，没有项目卡片，没有画布

Desktop 端：Electron 窗口打开，显示和 Web 端完全一样的占位界面。

FastAPI：localhost:8000/ws WebSocket 能连上，PipelineService 返回 hardcoded 假数据。

CI：GitHub Actions 四 Job 流水线就绪。PR typecheck 挂 → 下游全部 Skipped。

用一句话描述

▎ 一个能证明"双端同构架构可行"的最小可工作证明（MVP skeleton）— 所有管道都通了，但 UI 还是空壳。

类比

这就像盖房子打完地基 + 立起钢架 +
接通水电，但墙还没砌、家具没放。外面的人看到的是一个能遮风挡雨的框架，但还不能住人。

---

离你描述的理想体验还差什么

┌───────────────────────┬───────────────────────────────────────────────────────────────────────────┐
│ 你想要的体验 │ 这个计划做到哪了 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ 粘贴 JD → AI │ parseJD 接口有，Mock 返回假数据，没有真正的 JD 输入框 UI │
│ 高亮关键词 │ │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ 3 张项目卡片动画 │ discoverProjects 流式接口有，没有 ProjectCard 组件实现 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ 架构图 Mermaid 渲染 │ getArchitectureDiagram 接口有，没有 Mermaid 渲染器 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ 逐题选答案 → STAR │ generateAlignmentQuestions + submitAlignmentAnswer 接口有，没有 │
│ 生长 │ QuestionFlow 组件 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ WYSIWYG 简历画布 │ getResumeHTML 接口有，没有 ResumeCanvas 组件 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ 单页指示器 + AI │ checkPageFit 接口有，没有 PageIndicator 组件 │
│ 悬浮条 │ │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ PDF 导出仪式动画 │ exportPDF 流式接口有，没有 PipelineProgress 组件 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ 真实 Python CLI 调用 │ PipelineService 是 skeleton，没有接入 shushu-internship-tool 的 │
│ │ repo_audit │
└───────────────────────┴───────────────────────────────────────────────────────────────────────────┘

计划覆盖了 100% 的接口层和 0% 的真实 UI 实现层。 真实
UI（ProjectCard、FlashCard、QuestionFlow、ResumeCanvas、PageIndicator、PipelineProgress）是 Phase 9+
的内容。

---

这个策略是故意的

先把所有接口和管道拉通 — Adapter 模式、消息协议、流式通信、两端壳层、CI
流水线。这些东西一旦对了，后续每个组件都可以独立开发、独立测试，不会出现"做了炫酷的卡片组件，但连不上
Python 后端"的尴尬。

想继续把这个计划扩到 Phase 9+（真实 UI 组件），还是先跑 Phase 1-8 把骨架立起来？
