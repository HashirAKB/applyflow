// Bundles eval/run.ts for Node and runs it (keeps the eval on the exact same source as the extension).
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('node_modules/.cache', { recursive: true });
const outfile = 'node_modules/.cache/applyflow-eval.mjs';
await build({ entryPoints: ['eval/run.ts'], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'warning' });
await import(`../${outfile}`);
