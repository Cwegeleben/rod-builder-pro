import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      include: ['**/*.unit.test.ts'],
      name: 'unit',
      environment: 'node',
      setupFiles: ['tests/vitest.setup.ts'],
    },
  },
  {
    test: {
      include: ['**/*.it.test.tsx'],
      name: 'integration',
      browser: {
        enabled: true,
        provider: 'playwright',
        name: 'chromium',
      },
    },
  },
])
