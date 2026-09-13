import { spawn, execSync } from 'node:child_process';

export const isWindows = process.platform === 'win32';

export function fail(prefix, message) {
  console.error(`[${prefix}] ${message}`);
  process.exit(1);
}

export async function waitForHttpOk(url, timeoutMs, prefix) {
  const start = Date.now();
  console.error(`[${prefix}] Waiting for ${url}...`);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.error(`[${prefix}] Ready: ${url}`);
        return;
      }
    } catch {
      // retry until timeout
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail(prefix, `Timed out waiting for ${url} (${timeoutMs}ms)`);
}

export function spawnDetached(command, args, options) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    detached: !isWindows,
    ...options,
  });
}

export function attachChildLifecycle(child, { prefix, forceKillMs = 10_000 }) {
  let shuttingDown = false;

  function killTree(force = false) {
    if (!child.pid) {
      return;
    }
    if (isWindows) {
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // already gone
      }
      return;
    }
    try {
      process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
    } catch {
      try {
        child.kill(force ? 'SIGKILL' : 'SIGTERM');
      } catch {
        // already gone
      }
    }
  }

  function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.error(`[${prefix}] Shutting down (${signal})...`);
    killTree(false);
    const timer = setTimeout(() => {
      console.error(`[${prefix}] Force-killing process tree...`);
      killTree(true);
    }, forceKillMs);
    child.once('exit', () => {
      clearTimeout(timer);
    });
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => shutdown(signal));
  }

  child.on('error', (error) => {
    fail(prefix, `Failed to start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      process.exit(0);
    }
    if (signal) {
      fail(prefix, `Process terminated by signal ${signal}`);
    }
    if (code !== 0) {
      fail(prefix, `Exited with code ${code}`);
    }
    process.exit(0);
  });
}
