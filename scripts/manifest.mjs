// Builds manifest.json. Kept as code so the e2e build can add a test-only host.

/** Job sites with a dedicated adapter. Host access lets the extension inject on demand there. */
export const ADAPTER_HOSTS = [
  'https://boards.greenhouse.io/*',
  'https://job-boards.greenhouse.io/*',
  'https://jobs.lever.co/*',
  'https://jobs.ashbyhq.com/*',
  'https://apply.workable.com/*',
  'https://www.linkedin.com/*',
  'https://www.naukri.com/*',
];

export function manifest({ version, e2e = false }) {
  return {
    manifest_version: 3,
    name: 'applyflow',
    version,
    description: 'Fill job applications from your own profile and answer bank. Local-first, asks before guessing.',
    minimum_chrome_version: '116',
    icons: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
    action: { default_title: 'Open applyflow' },
    side_panel: { default_path: 'sidepanel.html' },
    background: { service_worker: 'background.js', type: 'module' },
    // storage: local data. sidePanel: the UI. scripting: inject the content script only when the user asks.
    permissions: ['storage', 'sidePanel', 'scripting'],
    host_permissions: e2e ? [...ADAPTER_HOSTS, 'https://applyflow.test/*'] : ADAPTER_HOSTS,
    // Other career sites and the LLM endpoint are requested per origin at the moment the user needs them.
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
  };
}
