import { Frame, Navigation, TopBar } from '@shopify/polaris'
import { useLocation, useNavigate } from '@remix-run/react'
import { useMemo } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  const selected = useMemo(() => {
    const p = location.pathname
    if (p.startsWith('/app/products/templates')) return 'products-templates'
    if (p.startsWith('/app/products/import')) return 'products-import'
    if (p.startsWith('/app/products')) return 'products'
    return 'home'
  }, [location.pathname])

  return (
    <Frame
      navigation={
        <Navigation location={location.pathname}>
          <Navigation.Section
            items={[
              { label: 'Home', url: '/app', selected: selected === 'home', onClick: () => navigate('/app') },
              {
                label: 'Products',
                url: '/app/products',
                selected: selected === 'products',
                onClick: () => navigate('/app/products'),
              },
              {
                label: 'Import',
                url: '/app/products/import',
                selected: selected === 'products-import',
                onClick: () => navigate('/app/products/import'),
              },
              {
                label: 'Spec Templates',
                url: '/app/products/templates',
                selected: selected === 'products-templates',
                onClick: () => navigate('/app/products/templates'),
              },
            ]}
          />
        </Navigation>
      }
      topBar={<TopBar />}
    >
      {children}
    </Frame>
  )
}
