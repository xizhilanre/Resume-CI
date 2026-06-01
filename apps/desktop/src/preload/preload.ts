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
