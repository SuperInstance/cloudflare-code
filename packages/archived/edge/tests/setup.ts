/**
 * Test setup for Jest
 */

export const mockEnv = {
  AI: {},
  DB: {
    prepare: () => ({
      bind: () => Promise.resolve([]),
      all: () => Promise.resolve([]),
      first: () => Promise.resolve(null),
      run: () => Promise.resolve({ success: true }),
    }),
  } as unknown as D1Database,
  KV: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  } as unknown as KVNamespace,
  R2: {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  } as unknown as R2Bucket,
  ENVIRONMENT: 'test',
  LOG_LEVEL: 'debug',
};
