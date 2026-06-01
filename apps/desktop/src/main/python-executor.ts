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
        "--port", "18920",
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
