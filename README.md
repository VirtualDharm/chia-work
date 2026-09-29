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
