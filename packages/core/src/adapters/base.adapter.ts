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
