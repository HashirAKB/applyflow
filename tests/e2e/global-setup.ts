import { execFileSync } from 'node:child_process';

// Build once with the test-only host (https://applyflow.test) so the generic adapter can be exercised.
export default function globalSetup() {
  execFileSync('node', ['scripts/build.mjs', '--e2e'], { stdio: 'inherit' });
}
