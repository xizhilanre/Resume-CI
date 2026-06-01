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
