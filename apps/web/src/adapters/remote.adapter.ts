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
    const pending = this.pending;

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

        pending.set(id, {
          ...entry,
          resolve: (_result: unknown) => {
            done = true;
            resolveNext?.({ value: undefined as never, done: true });
          },
          reject: (_err: Error) => {
            done = true;
            resolveNext?.({ value: undefined as never, done: true });
          },
        });

        return {
          next: () => {
            if (done)
              return Promise.resolve({ value: undefined as never, done: true });
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
        resolve: (v) => resolve((v as Record<string, unknown>)?.html as string ?? ""),
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
        resolve: (v) => resolve(v as { currentPages: number; status: "fit" | "overflow" | "underflow" }),
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
