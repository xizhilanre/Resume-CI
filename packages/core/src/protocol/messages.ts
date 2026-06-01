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
