// BullMQ worker for production (requires REDIS_URL).
// Run with: npm run worker
import '../src/lib/jobs/index';
import { startWorker } from '../src/lib/queue';

startWorker();
console.log('[gcs] worker started');
