// Minimal integration-style render using Vitest's jsdom without relying on @testing-library/react
import React from 'react'
import { describe, expect, test } from 'vitest'
import GlobalLogList from '../GlobalLogList'

async function simpleRender(node: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const ReactDOM = await import('react-dom')
  const maybeCreateRoot: ((el: Element) => { render: (n: React.ReactElement) => void }) | undefined =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ReactDOM as any).createRoot
  if (maybeCreateRoot) {
    const root = maybeCreateRoot(container)
    root.render(node)
  } else {
    // Legacy ReactDOM.render fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ReactDOM as any).render(node, container)
  }
  return container
}

const templateNames = { tpl1: 'Import One' }

describe('GlobalLogList — publish live indicator', () => {
  test('shows live publish with percent in Active runs', async () => {
    const now = new Date().toISOString()
    // Seed rows with a publish:start and publish:progress; ensure order newest->oldest handled in component
    const items = [
      {
        at: now,
        templateId: 'tpl1',
        runId: 'runA',
        type: 'publish:progress',
        payload: { processed: 5, target: 10, pct: 50 },
      },
      {
        at: new Date(Date.now() - 1000).toISOString(),
        templateId: 'tpl1',
        runId: 'runA',
        type: 'publish:start',
        payload: { target: 10 },
      },
    ]
    const c = await simpleRender(<GlobalLogList items={items} templateNames={templateNames} />)
    expect(c.textContent).toMatch(/Active runs/i)
    expect(c.textContent).toMatch(/publishing 50%/i)
  })
})
