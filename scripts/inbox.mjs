// Local helper for the prompt queue (reads BLOB_READ_WRITE_TOKEN from .env.local).
//   node scripts/inbox.mjs            list all pending prompts
//   node scripts/inbox.mjs done <key>  remove a prompt once it has been handled
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { list, get, del } from '@vercel/blob';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
if (!process.env.BLOB_READ_WRITE_TOKEN && existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^BLOB_READ_WRITE_TOKEN="?([^"]*)"?$/); if (m) process.env.BLOB_READ_WRITE_TOKEN = m[1];
  }
}
export async function readItem(key) {
  const r = await get(key, { access: 'private', useCache: false });
  return JSON.parse(await new Response(r.stream).text());
}
export async function removeItem(key) { await del(key); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, key] = process.argv.slice(2);
  if (cmd === 'done') {
    if (!key) { console.error('usage: node scripts/inbox.mjs done <key>'); process.exit(1); }
    await del(key); console.log('removed', key);
  } else {
    const { blobs } = await list({ prefix: 'inbox/', limit: 1000 });
    if (!blobs.length) { console.log('inbox empty'); process.exit(0); }
    for (const b of blobs.sort((x, y) => x.pathname.localeCompare(y.pathname))) {
      const j = await readItem(b.pathname);
      console.log(`\n[${j.doc}] ${j.createdAt}${j.name ? ` · ${j.name}` : ''}\n  key: ${b.pathname}\n  ${j.text.replace(/\n/g, '\n  ')}`);
    }
  }
}
