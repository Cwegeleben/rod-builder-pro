// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import { useLocation, useNavigate } from '@remix-run/react'
import { Tabs } from '@shopify/polaris'

const tabs = [
  { id: 'all', content: 'All Products', url: '/app/products' },
  { id: 'import', content: 'Import', url: '/app/products/import' },
  { id: 'templates', content: 'Spec Templates', url: '/app/products/templates' },
]

export function ProductsTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname

  const selected = tabs.findIndex(t => pathname === t.url || pathname.startsWith(t.url + '/'))

  return (
    <Tabs
      tabs={tabs.map(t => ({ id: t.id, content: t.content }))}
      selected={selected === -1 ? 0 : selected}
      onSelect={index => navigate(tabs[index].url)}
    />
  )
}
// <!-- END RBP GENERATED: products-module-v3-0 -->
