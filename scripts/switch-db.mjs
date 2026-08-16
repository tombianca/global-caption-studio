// Switches the active Prisma schema between postgres and sqlite.
// Usage: node scripts/switch-db.mjs sqlite | postgres
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (target !== 'sqlite' && target !== 'postgres') {
  console.error('Usage: node scripts/switch-db.mjs sqlite|postgres');
  process.exit(1);
}
const src = join(root, 'prisma', `schema.${target}.prisma`);
const dst = join(root, 'prisma', 'schema.prisma');
writeFileSync(dst, readFileSync(src, 'utf8'));
console.log(`Active Prisma schema -> ${target} (prisma/schema.prisma)`);
