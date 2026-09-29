// Public prompt queue. GET ?doc=<id> lists pending prompts for a document;
// POST {doc, text, name} adds one. Stored in a PRIVATE Vercel Blob store, so
// nothing is readable except through this endpoint, which returns only safe fields.
import { put, list, get } from '@vercel/blob';
import docs from '../docs.json' with { type: 'json' };

const IDS = new Set(docs.map((d) => d.id));
const MAX_TEXT = 2000, MAX_NAME = 60, MAX_PENDING_PER_DOC = 25, MIN_FILL_MS = 2500;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, n);

async function pending(doc) {
  const { blobs } = await list({ prefix: `inbox/${doc}/`, limit: 100 });
  const items = await Promise.all(blobs.map(async (b) => {
    try {
      const r = await get(b.pathname, { access: 'private', useCache: false });
      const j = JSON.parse(await new Response(r.stream).text());
      return { text: j.text, name: j.name || '', createdAt: j.createdAt };
    } catch { return null; }
  }));
  return items.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const doc = String(req.query.doc || '');
      if (!IDS.has(doc)) return res.status(404).json({ error: 'unknown document' });
      return res.status(200).json({ pending: await pending(doc) });
    }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (b.website) return res.status(200).json({ ok: true });            // honeypot: bots fill hidden fields
      if (!b.t || Date.now() - Number(b.t) < MIN_FILL_MS) return res.status(400).json({ error: 'Please take a moment before sending.' });
      const doc = String(b.doc || '');
      if (!IDS.has(doc)) return res.status(404).json({ error: 'unknown document' });
      const text = clean(b.text, MAX_TEXT), name = clean(b.name, MAX_NAME);
      if (text.length < 3) return res.status(400).json({ error: 'Prompt is too short.' });
      const { blobs } = await list({ prefix: `inbox/${doc}/`, limit: MAX_PENDING_PER_DOC + 1 });
      if (blobs.length >= MAX_PENDING_PER_DOC) return res.status(429).json({ error: 'Queue is full for this document. Try later.' });
      const createdAt = new Date().toISOString();
      const key = `inbox/${doc}/${createdAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`;
      await put(key, JSON.stringify({ doc, text, name, createdAt, ua: clean(req.headers['user-agent'], 200) }), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
      });
      return res.status(201).json({ ok: true, item: { text, name, createdAt } });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('[inbox]', e);
    return res.status(500).json({ error: 'Could not reach the queue. Try again.' });
  }
}
