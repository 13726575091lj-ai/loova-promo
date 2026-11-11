// Serve the editor locally:  node tools/preview-server.mjs [port]  → http://127.0.0.1:5173
import { serve } from './browser.mjs';

const port = Number(process.argv[2] || 5173);
await serve(port);
console.log(`LOOVA editor: http://127.0.0.1:${port}/index.html`);
