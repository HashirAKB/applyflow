// Zips dist/ into applyflow.zip for the release and the Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('applyflow.zip', { force: true });
execFileSync('zip', ['-r', '-X', '../applyflow.zip', '.'], { cwd: 'dist', stdio: 'inherit' });
console.log('wrote applyflow.zip');
