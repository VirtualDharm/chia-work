// Usage: node scripts/add.mjs "<path to file>" --title "..." --input "..." --output "..." [--id slug] [--date YYYY-MM-DD]
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
const entry = {
  id, file,
  title: opt.title || basename(src, extname(src)),
  date: opt.date || new Date().toISOString().slice(0, 10),
  input: opt.input || '',
  output: opt.output || '',
};
const at = docs.findIndex((d) => d.id === id);
if (at >= 0) docs[at] = { ...docs[at], ...entry }; else docs.unshift(entry);
writeFileSync(path, JSON.stringify(docs, null, 2) + '\n');
console.log(`${at >= 0 ? 'updated' : 'added'} "${entry.title}" as files/${file}`);
