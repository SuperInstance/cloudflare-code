/**
 * Polyfills and shims for Node.js compatibility
 */

// Ensure process is available
if (typeof process === 'undefined') {
  (globalThis as any).process = {
    cwd: () => '/',
    env: {},
    version: 'v18.0.0',
    platform: 'linux',
    arch: 'x64',
  };
}

// Ensure Buffer is available
if (typeof Buffer === 'undefined') {
  (globalThis as any).Buffer = {
    from: (data: string) => data,
  };
}
