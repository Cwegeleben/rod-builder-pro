import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelStatusBadge } from '../../designStudio/PanelStatusBadge'

describe('PanelStatusBadge', () => {
  it('renders a badge when count is greater than zero', () => {
    const html = renderToStaticMarkup(<PanelStatusBadge severity="error" count={2} />)
    expect(html).toContain('Needs attention')
    expect(html).toContain('(2)')
  })

  it('renders nothing when there are no validation items', () => {
    const html = renderToStaticMarkup(<PanelStatusBadge severity="warning" count={0} />)
    expect(html).toBe('')
  })
})
