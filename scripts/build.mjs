// Builds dist/index.html from docs.json and copies files/ into dist/files/.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const docs = JSON.parse(readFileSync(join(root, 'docs.json'), 'utf8'))
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OFFICE = new Set(['.pptx', '.ppt', '.docx', '.doc', '.xlsx', '.xls']);
const kind = (f) => (extname(f).toLowerCase() === '.pdf' ? 'pdf' : OFFICE.has(extname(f).toLowerCase()) ? 'office' : 'other');
const label = (f) => extname(f).slice(1).toUpperCase();

for (const d of docs) {
  if (!existsSync(join(root, 'files', d.file))) throw new Error(`missing file for "${d.id}": files/${d.file}`);
}

const index = docs.map((d, i) => `
      <li><a href="#${esc(d.id)}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(d.title)}</span><span class="m">${label(d.file)} · ${esc(d.date || '')}</span></a></li>`).join('');

const sections = docs.map((d, i) => `
    <section id="${esc(d.id)}" class="doc">
      <header>
        <span class="n">${String(i + 1).padStart(2, '0')}</span>
        <h2>${esc(d.title)}</h2>
        <span class="m">${label(d.file)} · ${esc(d.date || '')}</span>
      </header>
      <div class="io">
        <div><h3>Input</h3><p>${esc(d.input)}</p></div>
        <div><h3>Output</h3><p>${esc(d.output)}</p></div>
      </div>
      <div class="viewer" data-kind="${kind(d.file)}" data-file="files/${encodeURIComponent(d.file)}"></div>
      <p class="links"><a href="files/${encodeURIComponent(d.file)}" download>Download ${label(d.file)}</a> · <a href="#top">Back to list</a></p>
    </section>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Chiya's Work</title>
<style>
  :root { --bg:#f6f5f1; --fg:#1d1d1b; --muted:#6b6a64; --line:#dddbd3; --card:#fff; --accent:#2f5d50; }
  @media (prefers-color-scheme: dark) { :root { --bg:#151514; --fg:#ecebe6; --muted:#9a998f; --line:#2c2b28; --card:#1d1d1b; --accent:#8cc5b1; } }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 40px 20px 80px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  ol.index { list-style: none; padding: 0; margin: 0 0 56px; border-top: 1px solid var(--line); }
  ol.index a { display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; align-items: baseline; padding: 12px 4px; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; }
  ol.index a:hover .t { color: var(--accent); text-decoration: underline; }
  .n { color: var(--muted); font-variant-numeric: tabular-nums; }
  .m { color: var(--muted); font-size: 13px; white-space: nowrap; }
  .doc { scroll-margin-top: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-bottom: 40px; }
  .doc header { display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; align-items: baseline; margin-bottom: 14px; }
  .doc h2 { font-size: 19px; margin: 0; }
  .io { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .io h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 4px; }
  .io p { margin: 0; }
  .viewer { position: relative; width: 100%; aspect-ratio: 16 / 10.5; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .viewer iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .viewer .ph { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); }
  .links { margin: 12px 0 0; font-size: 14px; }
  .links a { color: var(--accent); }
  @media (max-width: 700px) { .io { grid-template-columns: 1fr; } .viewer { aspect-ratio: 3 / 4; } ol.index a, .doc header { grid-template-columns: 32px 1fr; } ol.index .m, .doc header .m { grid-column: 2; } }
</style>
</head>
<body>
<main id="top">
  <h1>Chiya's Work</h1>
  <p class="sub">${docs.length} documents. Click a name to jump to it.</p>
  <ol class="index">${index}
  </ol>${sections}
</main>
<script>
  // Office files render through Microsoft's viewer, which needs the file's absolute public URL.
  // PDFs use the browser's own viewer. Viewers load only when a section nears the screen.
  const load = (el) => {
    if (el.dataset.loaded) return; el.dataset.loaded = '1';
    const abs = new URL(el.dataset.file, location.href).href;
    const src = el.dataset.kind === 'office'
      ? 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(abs)
      : el.dataset.kind === 'pdf' ? abs : null;
    if (!src) { el.innerHTML = '<div class="ph">No preview for this file type. Use Download.</div>'; return; }
    const f = document.createElement('iframe'); f.src = src; f.title = 'Document preview'; f.allowFullscreen = true;
    el.appendChild(f);
  };
  const viewers = document.querySelectorAll('.viewer');
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    viewers.forEach((el) => { el.innerHTML = '<div class="ph">Preview works only on the live site (Office viewer needs a public URL).</div>'; });
  } else {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && load(e.target)), { rootMargin: '600px 0px' });
    viewers.forEach((el) => io.observe(el));
    addEventListener('hashchange', () => { const s = document.querySelector(location.hash + ' .viewer'); if (s) load(s); });
  }
</script>
</body>
</html>
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'files'), join(dist, 'files'), { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`built ${docs.length} documents -> dist/`);
