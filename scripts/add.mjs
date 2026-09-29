// Adds a document, or appends a new input/output turn if the id already exists.
// Usage: node scripts/add.mjs "<path to file>" [--from-inbox <key>] --title "..." --input "..." --output "..." [--id slug] [--date YYYY-MM-DD]
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [src, ...rest] = process.argv.slice(2);
if (!src) { console.error('usage: node scripts/add.mjs <file> --title ... --input ... --output ...'); process.exit(1); }
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const id = opt.id || slug(opt.title || basename(src, extname(src)));
const file = `${id}${extname(src).toLowerCase()}`;
copyFileSync(src, join(root, 'files', file));

const path = join(root, 'docs.json');
const docs = JSON.parse(readFileSync(path, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
let inboxInput = '';
if (opt['from-inbox']) {
  const { readItem } = await import('./inbox.mjs');
  const q = await readItem(opt['from-inbox']);
  inboxInput = q.name ? `${q.text} (from ${q.name})` : q.text;
}
const turn = { date: opt.date || today, input: opt.input || inboxInput, output: opt.output || '' };
const at = docs.findIndex((d) => d.id === id);
if (at >= 0) {
  // Same document again: replace the file, append this exchange to its thread.
  const d = docs[at];
  const turns = Array.isArray(d.turns) ? d.turns : (d.input || d.output ? [{ date: d.date, input: d.input, output: d.output }] : []);
  delete d.input; delete d.output;
  docs[at] = { ...d, file, title: opt.title || d.title, date: turn.date, turns: [...turns, turn] };
} else {
  docs.unshift({ id, file, title: opt.title || basename(src, extname(src)), date: turn.date, turns: [turn] });
}
writeFileSync(path, JSON.stringify(docs, null, 2) + '\n');
console.log(`${at >= 0 ? 'appended turn to' : 'added'} "${id}" (files/${file})`);
if (opt['from-inbox']) { const { removeItem } = await import('./inbox.mjs'); await removeItem(opt['from-inbox']); console.log('removed from inbox:', opt['from-inbox']); }
