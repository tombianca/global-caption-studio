import { randomUUID } from 'node:crypto';
import { config, isRedisConfigured } from './config';
import { getJobHandler } from './jobs';
import type { JobProgress } from './types';

let bullQueue: import('bullmq').Queue | null = null;
let workerStarted = false;

// In-process job state (dev / no Redis).
const inProcess = new Map<string, JobProgress>();
let chain: Promise<void> = Promise.resolve();

export function getJob(id: string): JobProgress | undefined {
  return inProcess.get(id);
}

function setJob(id: string, patch: Partial<JobProgress>): void {
  const cur = inProcess.get(id);
  inProcess.set(id, {
    ...(cur ?? { jobId: id, type: 'TRANSCRIBE', status: 'QUEUED', progress: 0 }),
    ...patch,
  });
}

async function runInProcess(id: string, name: string, payload: unknown): Promise<void> {
  const handler = getJobHandler(name);
  if (!handler) {
    setJob(id, { status: 'FAILED', error: `No handler registered for job "${name}"` });
    return;
  }
  setJob(id, { status: 'RUNNING' });
  try {
    await handler(payload, (progress, message) => setJob(id, { progress, message }));
    setJob(id, { status: 'COMPLETED', progress: 100 });
  } catch (err) {
    setJob(id, { status: 'FAILED', error: err instanceof Error ? err.message : String(err) });
  }
}

export async function enqueueJob(name: string, payload: unknown): Promise<string> {
  const type = name.toUpperCase() as JobProgress['type'];

  if (isRedisConfigured) {
    if (!bullQueue) {
      const { Queue } = await import('bullmq');
      bullQueue = new Queue('gcs', { connection: { url: config.redisUrl } });
    }
    const job = await bullQueue.add(name, payload as Record<string, unknown>);
    return String(job.id);
  }

  const id = randomUUID();
  setJob(id, { jobId: id, type, status: 'QUEUED', progress: 0 });
  chain = chain.then(() => runInProcess(id, name, payload)).catch(() => {});
  return id;
}

/** Start a BullMQ worker (no-op unless Redis is configured). Run via scripts/worker.ts. */
export function startWorker(): void {
  if (!isRedisConfigured || workerStarted) return;
  workerStarted = true;
  void (async () => {
    const { Worker } = await import('bullmq');
    const worker = new Worker(
      'gcs',
      async (job) => {
        const handler = getJobHandler(job.name);
        if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
        await handler(job.data, (progress, message) => job.updateProgress({ progress, message }));
      },
      { connection: { url: config.redisUrl } },
    );
    worker.on('failed', (job, err) => console.error('[gcs] job failed:', job?.name, err?.message));
  })();
}
