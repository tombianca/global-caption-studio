// Job registry: maps job names to handlers, shared by the in-process queue
// (dev) and the BullMQ worker (production).
export type JobReport = (progress: number, message?: string) => void;
export type JobHandler = (payload: unknown, report: JobReport) => Promise<void>;

const registry = new Map<string, JobHandler>();

export function registerJob(name: string, handler: JobHandler): void {
  registry.set(name, handler);
}

export function getJobHandler(name: string): JobHandler | undefined {
  return registry.get(name);
}
