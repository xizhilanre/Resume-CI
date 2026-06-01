# Resume CI 实现计划 — Phase 1-3: 地基 + 协议 + 连通

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Monorepo 脚手架，实现零依赖协议核心包 (`@resume-ci/core`)，并通过 Mock Adapter 验证 UI 骨架 5 步流程可走通。

**Architecture:** pnpm + Turborepo Monorepo，`@resume-ci/core` 为纯 TS 零依赖协议包，`@resume-ci/ui` 通过 `IResumeCIAdapter` 接口消费服务。

**Tech Stack:** pnpm 9, Turborepo 2, TypeScript 5.7, React 19, Vitest, tsx

---

### Task 1: 仓库根目录初始化

**Files:**
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/package.json`
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/pnpm-workspace.yaml`
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/tsconfig.base.json`
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/turbo.json`
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/.gitignore`
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/.npmrc`
- Create: `D:/MYdesktop/github/Resume-CI/resume-Ci/.node-version`

- [ ] **Step 1: 写 package.json**

```jsonc
{
  "name": "resume-ci",
  "private": true,
  "version": "0.1.0",
  "description": "从 JD 到一页 PDF 的全链路 AI 求职工具 — Monorepo",
  "scripts": {
    "dev": "concurrently -n web,desktop,fastapi -c cyan,magenta,yellow \"pnpm dev:web\" \"pnpm dev:desktop\" \"pnpm dev:fastapi\"",
    "dev:web": "turbo run dev --filter=@resume-ci/web",
    "dev:desktop": "turbo run dev --filter=@resume-ci/desktop",
    "dev:fastapi": "cd services/fastapi && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "codegen": "turbo run codegen",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\""
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "prettier": "^3.4.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "engines": {
    "node": ">=22",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: 写 pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: 写 tsconfig.base.json**

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@resume-ci/core":     ["./packages/core/src/index.ts"],
      "@resume-ci/core/*":   ["./packages/core/src/*"],
      "@resume-ci/ui":       ["./packages/ui/src/index.ts"],
      "@resume-ci/ui/*":     ["./packages/ui/src/*"]
    }
  }
}
```

- [ ] **Step 4: 写 turbo.json**

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false,
      "concurrency": 3
    },
    "test": {
      "dependsOn": [],
      "cache": true,
      "inputs": ["src/**", "test/**", "**/*.test.*"]
    },
    "lint": {
      "dependsOn": [],
      "cache": true
    },
    "codegen": {
      "dependsOn": [],
      "outputs": [
        "packages/core/src/schemas/generated/**",
        "services/fastapi/app/schemas/generated/**"
      ],
      "cache": true
    },
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

- [ ] **Step 5: 写 .npmrc**

```
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 6: 写 .gitignore**

```
node_modules/
dist/
.next/
.turbo/
*.tsbuildinfo
.env
.env.local
```

- [ ] **Step 7: 写 .node-version**

```
22
```

- [ ] **Step 8: 安装依赖并验证**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm install
pnpm exec turbo --version
```

Expected: `pnpm install` 成功，turbo 版本号打印

- [ ] **Step 9: Commit**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
git init
git add -A
git commit -m "feat: init monorepo scaffold with pnpm + turborepo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 创建 @resume-ci/core 包

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/vitest.config.ts`

- [ ] **Step 1: 写 packages/core/package.json**

```jsonc
{
  "name": "@resume-ci/core",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "codegen": "tsx scripts/codegen.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 写 packages/core/tsconfig.json**

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 写 packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: 写 packages/core/src/index.ts（空导出占位）**

```typescript
// @resume-ci/core — 零依赖协议层
// 后续 Task 逐步填充
export const VERSION = '0.1.0';
```

- [ ] **Step 5: 安装并验证**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm install
pnpm turbo run typecheck --filter=@resume-ci/core
```

Expected: typecheck 通过（无错误）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold @resume-ci/core zero-dep protocol package

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 定义消息协议类型

**Files:**
- Create: `packages/core/src/protocol/messages.ts`
- Create: `packages/core/src/protocol/messages.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// packages/core/src/protocol/messages.test.ts
import { describe, it, expect } from 'vitest';
import { isClientMessage, isServerMessage, createCmd, createCancel } from './messages';

describe('ClientMessage', () => {
  it('validates cmd message', () => {
    const msg = createCmd('jd.parse', { raw: 'hello' });
    expect(isClientMessage(msg)).toBe(true);
    expect(msg.type).toBe('cmd');
    expect(msg.method).toBe('jd.parse');
  });

  it('validates cancel message', () => {
    const msg = createCancel('abc-123');
    expect(isClientMessage(msg)).toBe(true);
    expect(msg.type).toBe('cancel');
    expect(msg.id).toBe('abc-123');
  });

  it('cmd has unique id', () => {
    const a = createCmd('resume.get', {});
    const b = createCmd('resume.get', {});
    expect(a.id).not.toBe(b.id);
  });
});

describe('ServerMessage', () => {
  it('validates done with result', () => {
    const msg = { type: 'done' as const, id: '1', result: { text: 'hello' } };
    expect(isServerMessage(msg)).toBe(true);
    expect(msg.result).toEqual({ text: 'hello' });
  });

  it('validates err with partial', () => {
    const msg = { type: 'err' as const, id: '1', code: 'TIMEOUT', message: 'timeout', partial: 'half' };
    expect(isServerMessage(msg)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm turbo run test --filter=@resume-ci/core
```

Expected: FAIL — 函数未定义

- [ ] **Step 3: 实现消息协议**

```typescript
// packages/core/src/protocol/messages.ts

let _seq = 0;
function nextId(): string {
  _seq++;
  return `${Date.now().toString(36)}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Client → Server ───

export type ClientMessage =
  | { type: 'cmd';  id: string; method: string; params: Record<string, unknown> }
  | { type: 'cancel'; id: string };

export function createCmd(method: string, params: Record<string, unknown>): ClientMessage {
  return { type: 'cmd', id: nextId(), method, params };
}

export function createCancel(id: string): ClientMessage {
  return { type: 'cancel', id };
}

export function isClientMessage(v: unknown): v is ClientMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (m['type'] === 'cmd') return typeof m['id'] === 'string' && typeof m['method'] === 'string';
  if (m['type'] === 'cancel') return typeof m['id'] === 'string';
  return false;
}

// ─── Server → Client ───

export type ServerMessage =
  | { type: 'ack';  id: string }
  | { type: 'chunk'; id: string; data: unknown; seq: number }
  | { type: 'done';  id: string; result: unknown }
  | { type: 'err';   id: string; code: string; message: string; partial?: unknown };

export function isServerMessage(v: unknown): v is ServerMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return ['ack', 'chunk', 'done', 'err'].includes(m['type'] as string)
    && typeof m['id'] === 'string';
}

// ─── 方法注册表 ───

export const METHOD_REGISTRY = {
  'jd.parse':              { stream: false } as const,
  'project.discover':      { stream: true  } as const,
  'project.audit':         { stream: true  } as const,
  'project.diagram':       { stream: false } as const,
  'project.challenges':    { stream: false } as const,
  'alignment.questions':   { stream: true  } as const,
  'alignment.answer':      { stream: true  } as const,
  'resume.get':            { stream: false } as const,
  'resume.update':         { stream: false } as const,
  'resume.polish':         { stream: true  } as const,
  'resume.fit':            { stream: false } as const,
  'export.pdf':            { stream: true  } as const,
} as const;

export type MethodName = keyof typeof METHOD_REGISTRY;
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm turbo run test --filter=@resume-ci/core
```

Expected: 3 tests PASS

- [ ] **Step 5: 更新 packages/core/src/index.ts 导出**

```typescript
export * from './protocol/messages';
export const VERSION = '0.1.0';
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): define client/server message protocol types

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 定义 IResumeCIAdapter 接口

**Files:**
- Create: `packages/core/src/adapters/base.adapter.ts`

- [ ] **Step 1: 写接口定义**

```typescript
// packages/core/src/adapters/base.adapter.ts

/**
 * Resume CI 核心适配器接口。
 * Web 端和 Desktop 端 100% 复用 UI，仅注入不同的 Adapter 实现。
 * - 带 AsyncIterable 返回值的方法 = 流式（支持 chunk 推送 + cancel）
 * - 带 Promise 返回值的方法 = 非流式（一次性返回）
 */
export interface IResumeCIAdapter {
  // ─── Step 1: 锚点输入 ───
  /** 解析 JD 文本 → 关键词、技术栈、角色类型 */
  parseJD(raw: string): Promise<unknown>;

  // ─── Step 2: 项目蓝图 ───
  /** 流式返回 2-3 张项目卡片 */
  discoverProjects(jd: unknown): AsyncIterable<unknown>;
  /** 获取项目架构图 Mermaid DSL */
  getArchitectureDiagram(projectId: string): Promise<string>;
  /** 获取技术挑战闪卡 */
  getTechChallenges(projectId: string): Promise<unknown[]>;

  // ─── Step 3: 证据对齐 ───
  /** 流式返回对齐问题（一次一道） */
  generateAlignmentQuestions(projectId: string): AsyncIterable<unknown>;
  /** 提交答案 → 流式返回 STAR bullet */
  submitAlignmentAnswer(questionId: string, answer: string): AsyncIterable<string>;

  // ─── Step 4: 简历精修 ───
  /** 获取当前简历 HTML 源码 */
  getResumeHTML(): Promise<string>;
  /** 更新某 section 内容 */
  updateResumeSection(section: string, content: string): Promise<void>;
  /** AI 润色指定文本 */
  aiPolish(text: string, style: string): AsyncIterable<string>;
  /** 检查单页适配状态 */
  checkPageFit(): Promise<{ currentPages: number; status: 'fit' | 'overflow' | 'underflow' }>;

  // ─── Step 5: 导出 ───
  /** 流式导出 PDF */
  exportPDF(): AsyncIterable<{ stage: string; progress: number }>;

  // ─── 生命周期 ───
  /** 发送命令（返回命令 ID，用于 cancel） */
  send(method: string, params: Record<string, unknown>): string;
  /** 取消正在执行的命令 */
  cancel(id: string): void;
}
```

- [ ] **Step 2: 更新 index.ts 导出**

```typescript
// packages/core/src/index.ts
export * from './protocol/messages';
export * from './adapters/base.adapter';
export const VERSION = '0.1.0';
```

- [ ] **Step 3: typecheck 验证**

```bash
pnpm turbo run typecheck --filter=@resume-ci/core
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(core): define IResumeCIAdapter interface

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 实现 Mock Adapter（用于 UI 开发 & 测试）

**Files:**
- Create: `packages/core/src/adapters/mock.adapter.ts`
- Create: `packages/core/src/adapters/mock.adapter.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// packages/core/src/adapters/mock.adapter.test.ts
import { describe, it, expect } from 'vitest';
import { MockAdapter } from './mock.adapter';

describe('MockAdapter', () => {
  it('parseJD returns mock parsed result', async () => {
    const adapter = new MockAdapter();
    const result = await adapter.parseJD('需要熟悉 React 和 TypeScript');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('techStack');
  });

  it('discoverProjects yields 3 cards', async () => {
    const adapter = new MockAdapter();
    const cards: unknown[] = [];
    for await (const chunk of adapter.discoverProjects({})) {
      cards.push(chunk);
    }
    // Mock 投喂 3 次，每次 1 张卡片
    expect(cards.length).toBe(3);
  });

  it('cancel stops a running command', async () => {
    const adapter = new MockAdapter();
    const id = adapter.send('export.pdf', {});
    adapter.cancel(id);
    // cancel 是同步操作，不应抛错
  });

  it('send returns unique ids', () => {
    const adapter = new MockAdapter();
    const a = adapter.send('resume.get', {});
    const b = adapter.send('resume.get', {});
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm turbo run test --filter=@resume-ci/core
```

Expected: FAIL — MockAdapter not found

- [ ] **Step 3: 实现 MockAdapter**

```typescript
// packages/core/src/adapters/mock.adapter.ts
import type { IResumeCIAdapter } from './base.adapter';

let _mockSeq = 0;
function mockId(): string {
  return `mock-${Date.now().toString(36)}-${(++_mockSeq).toString(36)}`;
}

const MOCK_JD = {
  keywords: [
    { word: 'React', weight: 0.95 },
    { word: 'TypeScript', weight: 0.90 },
    { word: 'Node.js', weight: 0.75 },
  ],
  techStack: ['React', 'TypeScript', 'Next.js', 'Node.js'],
  roleType: 'frontend' as const,
  matchProfile: { score: 0.88, gaps: ['GraphQL', 'AWS'] },
};

const MOCK_CARDS = [
  {
    id: 'proj-1',
    title: '高并发 IM 即时通讯系统',
    techStack: ['Go', 'WebSocket', 'Redis', 'PostgreSQL'],
    jdMatchScore: 0.89,
    architecture: 'graph TD\n  Client-->Gateway\n  Gateway-->IM-Service\n  IM-Service-->Redis\n  IM-Service-->DB',
    challenges: [
      { question: '如何处理 10 万并发连接？', tip: '使用 epoll + goroutine 协程池' },
      { question: '消息如何保证不丢失？', tip: 'ACK 确认 + 消息持久化 + 重传队列' },
      { question: 'Redis 缓存击穿怎么解决？', tip: '互斥锁 + 永不过期 + 布隆过滤器' },
    ],
    runDepth: 'smoke-test' as const,
  },
  {
    id: 'proj-2',
    title: '分布式可扩展 KV 存储',
    techStack: ['Rust', 'gRPC', 'RocksDB', 'Raft'],
    jdMatchScore: 0.82,
    architecture: 'graph TD\n  Client-->Coordinator\n  Coordinator-->Node1\n  Coordinator-->Node2\n  Node1-->RocksDB\n  Node2-->RocksDB',
    challenges: [
      { question: 'Raft 选举超时怎么设置？', tip: '150-300ms 随机化避免脑裂' },
      { question: '读写分离怎样保证一致性？', tip: 'Read Index + Lease 机制' },
    ],
    runDepth: 'local-full-run' as const,
  },
  {
    id: 'proj-3',
    title: 'AI Agent 任务编排平台',
    techStack: ['Python', 'FastAPI', 'LangChain', 'PostgreSQL'],
    jdMatchScore: 0.76,
    architecture: 'graph TD\n  User-->API\n  API-->Orchestrator\n  Orchestrator-->Agent1\n  Orchestrator-->Agent2\n  Agent1-->LLM\n  Agent2-->Tools',
    challenges: [
      { question: '多 Agent 如何协作？', tip: '中心化 Orchestrator + Tool Call 协议' },
      { question: '上下文窗口溢出怎么办？', tip: '分层压缩 + 占位替换 + 按需检索' },
    ],
    runDepth: 'interview-only' as const,
  },
];

/** 提供可控的假数据，用于 UI 开发和单元测试 */
export class MockAdapter implements IResumeCIAdapter {
  // eslint-disable-next-line @typescript-eslint/require-await
  async parseJD(_raw: string): Promise<unknown> {
    return Promise.resolve(MOCK_JD);
  }

  async *discoverProjects(_jd: unknown): AsyncIterable<unknown> {
    for (const card of MOCK_CARDS) {
      await sleep(400);
      yield card;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getArchitectureDiagram(projectId: string): Promise<string> {
    const card = MOCK_CARDS.find((c) => c.id === projectId);
    return card?.architecture ?? 'graph TD\n  A-->B';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getTechChallenges(projectId: string): Promise<unknown[]> {
    const card = MOCK_CARDS.find((c) => c.id === projectId);
    return card?.challenges ?? [];
  }

  async *generateAlignmentQuestions(_projectId: string): AsyncIterable<unknown> {
    const questions = [
      { id: 'q1', text: '这个模块的 QPS 大概压测到了多少？', options: ['1k-5k', '5k-10k', '没测过，AI 估算'] },
      { id: 'q2', text: '分布式锁你打算用什么方案？', options: ['Redisson', '自研 ZooKeeper 锁', '数据库乐观锁'] },
      { id: 'q3', text: '缓存与数据库一致性怎么保证？', options: ['先删缓存再写DB', '先写DB再删缓存', 'Canal 订阅 binlog'] },
    ];
    for (const q of questions) {
      await sleep(300);
      yield q;
    }
  }

  async *submitAlignmentAnswer(_qId: string, answer: string): AsyncIterable<string> {
    await sleep(500);
    yield `基于 ${answer} 实现了核心模块，QPS 提升 40%，P99 延迟降低至 50ms。`;
  }

  async getResumeHTML(): Promise<string> {
    return '<html><body><div class="page"><h1>张武 — AI Agent 工程简历</h1></div></body></html>';
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async updateResumeSection(_section: string, _content: string): Promise<void> {
    // mock: 静默成功
  }

  async *aiPolish(text: string, _style: string): AsyncIterable<string> {
    await sleep(600);
    yield `[润色后] ${text}`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async checkPageFit(): Promise<{ currentPages: number; status: 'fit' | 'overflow' | 'underflow' }> {
    return { currentPages: 0.98, status: 'fit' };
  }

  async *exportPDF(): AsyncIterable<{ stage: string; progress: number }> {
    for (const [i, stage] of ['对齐排版', '嵌入字体', 'ATS 校验', '生成 PDF'].entries()) {
      await sleep(800);
      yield { stage, progress: (i + 1) / 4 };
    }
  }

  send(method: string, params: Record<string, unknown>): string {
    void method; void params;
    return mockId();
  }

  cancel(_id: string): void {
    // mock: 静默取消
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm turbo run test --filter=@resume-ci/core
```

Expected: 7 tests PASS (3 message protocol + 4 mock adapter)

- [ ] **Step 5: 更新 index.ts 导出**

```typescript
// packages/core/src/index.ts
export * from './protocol/messages';
export * from './adapters/base.adapter';
export * from './adapters/mock.adapter';
export const VERSION = '0.1.0';
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add MockAdapter with controllable fake data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 创建 @resume-ci/ui 包骨架

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/wizard/WizardState.ts`
- Create: `packages/ui/src/wizard/WizardState.test.ts`
- Create: `packages/ui/vitest.config.ts`

- [ ] **Step 1: 写 packages/ui/package.json**

```jsonc
{
  "name": "@resume-ci/ui",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@resume-ci/core": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: 写 packages/ui/tsconfig.json**

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 写 packages/ui/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: 写 Wizard 状态机测试**

```typescript
// packages/ui/src/wizard/WizardState.test.ts
import { describe, it, expect } from 'vitest';
import { createWizardState, type WizardStep, type WizardState } from './WizardState';

describe('WizardState', () => {
  it('starts at anchor step', () => {
    const state = createWizardState();
    expect(state.step).toBe('anchor');
    expect(state.jd).toBeNull();
    expect(state.canGoForward).toBe(false);
  });

  it('cannot go back from first step', () => {
    const state = createWizardState();
    expect(state.canGoBack).toBe(false);
  });

  it('setJD enables forward navigation', () => {
    const state = createWizardState();
    const next = { ...state, jd: { keywords: [], techStack: [], roleType: 'frontend' as const, matchProfile: { score: 1, gaps: [] } } };
    expect(next.canGoForward).toBe(true);
  });

  it('visited steps are tracked', () => {
    const state = createWizardState();
    expect(state.visitedSteps.has('anchor')).toBe(true);
    expect(state.visitedSteps.has('blueprint')).toBe(false);
  });
});
```

- [ ] **Step 5: 实现 WizardState**

```typescript
// packages/ui/src/wizard/WizardState.ts

export type WizardStep = 'anchor' | 'blueprint' | 'alignment' | 'polish' | 'export';

export interface JDParsed {
  keywords: { word: string; weight: number }[];
  techStack: string[];
  roleType: string;
  matchProfile: { score: number; gaps: string[] };
}

export interface WizardState {
  step: WizardStep;
  jd: JDParsed | null;
  selectedProject: { id: string; title: string } | null;
  resumeHTML: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  visitedSteps: Set<WizardStep>;
}

const STEP_ORDER: WizardStep[] = ['anchor', 'blueprint', 'alignment', 'polish', 'export'];

export function createWizardState(): WizardState {
  return {
    step: 'anchor',
    jd: null,
    selectedProject: null,
    resumeHTML: null,
    canGoBack: false,
    canGoForward: false,
    visitedSteps: new Set(['anchor']),
  };
}

export function getStepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step);
}

export function canAdvanceFrom(state: WizardState): boolean {
  switch (state.step) {
    case 'anchor':    return state.jd !== null;
    case 'blueprint':   return state.selectedProject !== null;
    case 'alignment':   return true;  // 对齐步骤允许跳过
    case 'polish':      return true;
    default:            return false;
  }
}
```

- [ ] **Step 6: 写 packages/ui/src/index.ts**

```typescript
export * from './wizard/WizardState';
```

- [ ] **Step 7: 安装并跑测试**

```bash
cd D:/MYdesktop/github/Resume-CI/resume-Ci
pnpm install
pnpm turbo run test --filter=@resume-ci/ui
```

Expected: 4 tests PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): scaffold wizard state machine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 文档位置

此计划 Phase 1-3 已存入 `docs/superpowers/plans/2026-05-31-resume-ci-phase1-3.md`。Phase 4-8 见后续计划文件。
