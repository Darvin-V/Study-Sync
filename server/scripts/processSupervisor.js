import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_INDEX = path.resolve(__dirname, '../index.js');

/**
 * StudySync AI — Resilient Process Supervisor
 * 
 * Manages server child process with bounded restarts, exponential backoff,
 * and infinite-loop crash prevention.
 */
export class ProcessSupervisor {
  constructor(options = {}) {
    this.serverScript = options.serverScript || SERVER_INDEX;
    this.maxRestarts = options.maxRestarts || 5;
    this.windowMs = options.windowMs || 60000;
    this.initialBackoffMs = options.initialBackoffMs || 500;
    this.maxBackoffMs = options.maxBackoffMs || 8000;
    this.restartTimestamps = [];
    this.child = null;
    this.isManualShutdown = false;
    this.onExitCallback = options.onExit || null;
  }

  start() {
    this.isManualShutdown = false;
    this._spawnChild();

    const forwardSignal = (sig) => {
      this.isManualShutdown = true;
      if (this.child && !this.child.killed) {
        this.child.kill(sig);
      }
    };

    this._sigintHandler = () => forwardSignal('SIGINT');
    this._sigtermHandler = () => forwardSignal('SIGTERM');

    process.on('SIGINT', this._sigintHandler);
    process.on('SIGTERM', this._sigtermHandler);
  }

  stop() {
    this.isManualShutdown = true;
    if (this._sigintHandler) process.removeListener('SIGINT', this._sigintHandler);
    if (this._sigtermHandler) process.removeListener('SIGTERM', this._sigtermHandler);
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM');
    }
  }

  _cleanOldRestarts(now = Date.now()) {
    this.restartTimestamps = this.restartTimestamps.filter((ts) => now - ts < this.windowMs);
  }

  _spawnChild() {
    this.child = fork(this.serverScript, [], {
      stdio: 'inherit',
      env: { ...process.env },
    });

    this.child.on('exit', (code, signal) => {
      if (this.isManualShutdown || code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') {
        console.log('[Supervisor] Server stopped cleanly. Exiting supervisor.');
        if (typeof this.onExitCallback === 'function') {
          this.onExitCallback(0);
        } else {
          process.exit(0);
        }
        return;
      }

      const now = Date.now();
      this._cleanOldRestarts(now);
      this.restartTimestamps.push(now);

      const recentRestarts = this.restartTimestamps.length;
      if (recentRestarts > this.maxRestarts) {
        console.error(
          `[Supervisor] FATAL: Server crashed ${recentRestarts} times within ${this.windowMs / 1000}s. Halting to prevent infinite restart loop.`
        );
        if (typeof this.onExitCallback === 'function') {
          this.onExitCallback(1);
        } else {
          process.exit(1);
        }
        return;
      }

      const backoff = Math.min(
        this.initialBackoffMs * Math.pow(2, recentRestarts - 1),
        this.maxBackoffMs
      );

      console.warn(
        `[Supervisor] Server crashed with exit code ${code}. Restarting in ${backoff}ms (Crash ${recentRestarts} of ${this.maxRestarts})...`
      );

      setTimeout(() => {
        if (!this.isManualShutdown) {
          this._spawnChild();
        }
      }, backoff);
    });
  }
}

// Auto-run if executed directly as a script
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const supervisor = new ProcessSupervisor();
  supervisor.start();
}

export default ProcessSupervisor;
