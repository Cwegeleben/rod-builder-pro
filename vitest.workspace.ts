import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      include: ['**/*.unit.test.ts'],
      name: 'unit',
      environment: 'node',
      // Serialize tests to avoid concurrent Prisma DB setup on SQLite
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
      setupFiles: ['tests/vitest.setup.ts'],
    },
  },
  {
    test: {
      include: ['**/*.it.test.tsx'],
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
      name: 'integration',
      browser: {
        enabled: true,
        provider: 'playwright',
        name: 'chromium',
      },
    },
  },
])
