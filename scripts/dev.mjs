import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(rootDir, "backend");
const isWindows = process.platform === "win32";

const commands = [
  {
    name: "backend",
    command: isWindows ? "python.exe" : "python3",
    args: ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd: backendDir,
  },
  {
    name: "frontend",
    command: isWindows ? "npx.cmd" : "npx",
    args: ["vite", "--host", "::", "--port", "8081", "--strictPort"],
    cwd: rootDir,
  },
];

const children = [];
let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(isWindows ? undefined : "SIGTERM");
    }
  }

  process.exitCode = exitCode;
}

for (const { name, command, args, cwd } of commands) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("error", (error) => {
    process.stderr.write(`[${name}] ${error.message}\n`);
    stopAll(1);
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      process.stderr.write(`[${name}] exited with ${reason}\n`);
      stopAll(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
