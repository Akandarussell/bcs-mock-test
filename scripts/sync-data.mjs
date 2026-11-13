// Copies ./data/questions.json -> ./public/data/questions.json so the static
// export serves the bank as a cacheable asset (keeps the JS bundle small).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'data', 'questions.json');
const dest = join(root, 'public', 'data', 'questions.json');

mkdirSync(dirname(dest), { recursive: true });
if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log('[sync-data] data/questions.json -> public/data/questions.json');
} else {
  writeFileSync(dest, '[]\n');
  console.warn('[sync-data] data/questions.json missing — run `npm run bank` first. Wrote an empty bank.');
}

