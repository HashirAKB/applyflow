// Bundles the extension into dist/. Usage: node scripts/build.mjs [--e2e]
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { manifest } from './manifest.mjs';

const e2e = process.argv.includes('--e2e') || process.env.APPLYFLOW_E2E === '1';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const out = 'dist';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = {
  bundle: true,
  minifySyntax: true, // drops test-only branches; whitespace and names stay readable for reviewers
  sourcemap: false,
  target: 'chrome116',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', __E2E__: String(e2e) },
  logLevel: 'warning',
};

await Promise.all([
  build({ ...common, entryPoints: ['src/background/index.ts'], outfile: `${out}/background.js`, format: 'esm' }),
  build({ ...common, entryPoints: ['src/content/index.ts'], outfile: `${out}/content.js`, format: 'iife' }),
  build({ ...common, entryPoints: ['src/sidepanel/main.tsx'], outfile: `${out}/sidepanel.js`, format: 'esm' }),
]);

cpSync('public', out, { recursive: true });
cpSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${out}/pdf.worker.min.mjs`);
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest({ version: pkg.version, e2e }), null, 2));
console.log(`built ${out}/ (e2e=${e2e})`);
