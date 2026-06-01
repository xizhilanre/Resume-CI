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

type PendingEntry = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  chunks: unknown[];
};

export class LocalAdapter implements IResumeCIAdapter {
  private pending = new Map<string, PendingEntry>();
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
        resolve: (v) => resolve((v as Record<string, unknown>)?.html as string ?? ""),
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
        resolve: (v) => resolve(v as { currentPages: number; status: "fit" | "overflow" | "underflow" }),
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
    const resolveQueue: Array<(v: IteratorResult<T>) => void> = [];
    let chunks: T[] = [];
    let finished = false;

    const entry: PendingEntry = {
      resolve: (result: unknown) => {
        if (Array.isArray((result as Record<string, unknown>)?.items)) {
          chunks = (result as Record<string, unknown>).items as T[];
        }
        finished = true;
        resolveQueue.forEach((r) => r({ value: undefined as never, done: true }));
      },
      reject: (_err: Error) => {
        finished = true;
        resolveQueue.forEach((r) => r({ value: undefined as never, done: true }));
      },
      chunks: [],
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
