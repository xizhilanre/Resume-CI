// apps/desktop/src/main/python-bootstrap.ts
import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const RUNTIME_DIR = path.join(app.getPath("userData"), "python-runtime");

export function ensurePythonRuntime(): string {
  const pythonExe = path.join(
    RUNTIME_DIR,
    process.platform === "win32" ? "python.exe" : "bin/python3"
  );

  if (fs.existsSync(pythonExe)) {
    return validateRuntime(pythonExe) ? pythonExe : "";
  }

  const zipPath = path.join(process.resourcesPath, "python-runtime.zip");
  if (!fs.existsSync(zipPath)) {
    throw new Error("Python runtime not found. Please reinstall the application.");
  }

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });

  if (process.platform === "win32") {
    execSync(`tar -xf "${zipPath}" -C "${RUNTIME_DIR}"`, { stdio: "pipe" });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${RUNTIME_DIR}"`, { stdio: "pipe" });
  }

  return pythonExe;
}

function validateRuntime(pythonExe: string): boolean {
  try {
    execSync(`"${pythonExe}" --version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
