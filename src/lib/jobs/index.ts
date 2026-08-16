// Side-effect imports register all job handlers with the registry.
// Imported by API routes (dev in-process queue) and scripts/worker.ts (BullMQ).
import './transcribe';
import './translate';
import './export';
