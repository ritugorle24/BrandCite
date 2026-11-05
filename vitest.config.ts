import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Limit to a single worker thread to avoid OOM.
    maxThreads: 1,
  },
});
