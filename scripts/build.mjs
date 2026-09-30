// Builds dist/index.html from docs.json and copies files/ into dist/files/.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const docs = JSON.parse(readFileSync(join(root, 'docs.json'), 'utf8'))
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OFFICE = new Set(['.pptx', '.ppt', '.docx', '.doc', '.xlsx', '.xls']);
const kind = (f) => (extname(f).toLowerCase() === '.pdf' ? 'pdf' : OFFICE.has(extname(f).toLowerCase()) ? 'office' : 'other');
// Older entries have a single input/output; newer ones have a list of turns.
const turnsOf = (d) => (Array.isArray(d.turns) && d.turns.length ? d.turns : [{ input: d.input || '', output: d.output || '', date: d.date }]);
// Content hash in the URL: Office's web viewer caches by URL, so a changed file needs a new URL.
const ver = (f) => createHash('sha1').update(readFileSync(join(root, 'files', f))).digest('hex').slice(0, 10);
const furl = (f) => `files/${encodeURIComponent(f)}?v=${ver(f)}`;
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
      <ol class="thread">${turnsOf(d).map((t, j, a) => `
        <li class="turn${j === a.length - 1 ? ' last' : ''}">
          <div class="msg in"><h3>Input ${j + 1}${t.date ? ` · ${esc(t.date)}` : ''}</h3><p>${esc(t.input)}</p></div>
          <div class="msg out"><h3>Claude · output ${j + 1}</h3><p>${esc(t.output)}</p></div>
        </li>`).join('')}
      </ol>
      <div class="ask" data-doc="${esc(d.id)}">
        <div class="pending" hidden><h3>Waiting for Claude</h3><ul></ul></div>
        <form>
          <label for="ask-${esc(d.id)}">Next prompt for Claude</label>
          <textarea id="ask-${esc(d.id)}" name="text" rows="3" maxlength="2000" required placeholder="What should Claude do next with this document?"></textarea>
          <div class="row">
            <input name="name" maxlength="60" placeholder="Your name (optional)" autocomplete="name">
            <input name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
            <button type="submit">Send to Claude</button>
          </div>
          <p class="status" role="status"></p>
        </form>
      </div>
      <div class="viewer" data-kind="${kind(d.file)}" data-file="${furl(d.file)}"></div>
      <p class="links"><a href="${furl(d.file)}" download>Download ${label(d.file)}</a> · <a href="#top">Back to list</a></p>
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
  ol.thread { list-style: none; margin: 0 0 16px; padding: 0; display: grid; gap: 10px; }
  .turn { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .msg { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .msg.in { background: var(--bg); }
  .msg.out { border-left: 3px solid var(--accent); }
  .msg h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 4px; font-weight: 600; }
  .msg p { margin: 0; }
  .turn.last .msg { border-color: var(--accent); }
  .ask { margin: 0 0 16px; }
  .ask h3, .ask label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 6px; font-weight: 600; }
  .pending { border: 1px dashed var(--line); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
  .pending ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  .pending li small { color: var(--muted); }
  .ask textarea, .ask input { width: 100%; font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; }
  .ask textarea { resize: vertical; }
  .ask .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 8px; }
  .ask button { font: inherit; border: 0; border-radius: 6px; padding: 8px 14px; background: var(--accent); color: var(--card); cursor: pointer; }
  .ask button[disabled] { opacity: .6; cursor: default; }
  .ask .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
  .ask .status { margin: 6px 0 0; font-size: 14px; color: var(--muted); min-height: 1.2em; }
  .viewer { position: relative; width: 100%; aspect-ratio: 16 / 10.5; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .viewer iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .viewer .ph { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); }
  .links { margin: 12px 0 0; font-size: 14px; }
  .links a { color: var(--accent); }
  @media (max-width: 700px) { .turn { grid-template-columns: 1fr; } .viewer { aspect-ratio: 3 / 4; } ol.index a, .doc header { grid-template-columns: 32px 1fr; } ol.index .m, .doc header .m { grid-column: 2; } }
</style>
</head>
<body>
<main id="top">
  <h1>Chiya's Work</h1>
  <p class="sub">${docs.length} ${docs.length === 1 ? "document" : "documents"}. Click a name to jump to it.</p>
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
    el.innerHTML = '';
    const f = document.createElement('iframe'); f.src = src; f.title = 'Document preview'; f.allowFullscreen = true;
    el.appendChild(f);
  };
  const viewers = [...document.querySelectorAll('.viewer')];
  const MAX_LIVE = 2;        // at most this many Office viewers alive at once
  const DWELL_MS = 450;      // must stay on screen this long (skips smooth-scroll pass-through)
  const live = [];
  const unload = (el) => { el.innerHTML = ''; delete el.dataset.loaded; };
  const activate = (el) => {
    if (!el.dataset.loaded) load(el);
    const i = live.indexOf(el); if (i >= 0) live.splice(i, 1); live.push(el);
    while (live.length > MAX_LIVE) unload(live.shift());
  };
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    viewers.forEach((el) => { el.innerHTML = '<div class="ph">Preview works only on the live site (Office viewer needs a public URL).</div>'; });
  } else {
    viewers.forEach((el) => { el.innerHTML = '<div class="ph">Loading preview…</div>'; });
    const timers = new Map();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      clearTimeout(timers.get(e.target));
      if (e.isIntersecting) timers.set(e.target, setTimeout(() => activate(e.target), DWELL_MS));
    }), { threshold: 0.2 });
    viewers.forEach((el) => io.observe(el));
  }

  // Prompt queue: show pending prompts and accept new ones.
  const opened = Date.now();
  const fmt = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const renderPending = (box, items) => {
    const wrap = box.querySelector('.pending'), ul = wrap.querySelector('ul');
    ul.innerHTML = '';
    items.forEach((it) => {
      const li = document.createElement('li');
      li.textContent = it.text;
      const s = document.createElement('small'); s.textContent = ' · ' + (it.name ? it.name + ', ' : '') + fmt(it.createdAt);
      li.appendChild(s); ul.appendChild(li);
    });
    wrap.hidden = !items.length;
  };
  document.querySelectorAll('.ask').forEach((box) => {
    const doc = box.dataset.doc, form = box.querySelector('form'), status = box.querySelector('.status'), btn = form.querySelector('button');
    let items = [];
    fetch('/api/inbox?doc=' + encodeURIComponent(doc)).then((r) => r.ok ? r.json() : { pending: [] })
      .then((j) => { items = j.pending || []; renderPending(box, items); }).catch(() => {});
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      btn.disabled = true; status.textContent = 'Sending…';
      try {
        const r = await fetch('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc, text: fd.get('text'), name: fd.get('name'), website: fd.get('website'), t: opened }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Could not send.');
        if (j.item) { items.push(j.item); renderPending(box, items); }
        form.reset(); status.textContent = 'Sent. Claude will pick this up and the reply will appear above as the next output.';
      } catch (err) { status.textContent = err.message; }
      finally { btn.disabled = false; }
    });
  });
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
