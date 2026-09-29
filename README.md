# Chiya's Work

Single-page site at https://chiyawork.scalepartner.store listing finished documents.
The top of the page is a numbered file list; clicking a name scrolls to that document's
viewer (PPT/DOCX/XLSX via Microsoft's Office web viewer, PDF via the browser).

## Add a document
```
node scripts/add.mjs "/path/to/deck.pptx" --title "Title" --input "What was asked" --output "What was delivered"
npm run deploy
```
Re-adding with the same `--id` (or same title) swaps in the new file and appends that input/output as the next turn in the thread.

Pages send `noindex` so search engines skip them; anyone with the link can view.

## Prompt queue
Each document has a "Next prompt for Claude" box. Submissions go to a private Vercel Blob
store (`chia-inbox`) and show on the page as "Waiting for Claude". They are NOT executed
automatically.
```
npm run inbox                                   # list pending prompts with their keys
node scripts/add.mjs "/path/new.pptx" --id <doc-id> --from-inbox <key> --output "what Claude did"
npm run deploy                                  # prompt becomes the next Input, reply the next Output
```
Limits: 2000 chars, 25 pending per document, hidden honeypot field, 2.5 s minimum fill time.
