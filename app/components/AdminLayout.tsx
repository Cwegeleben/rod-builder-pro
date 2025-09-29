import { Frame, TopBar } from '@shopify/polaris'
import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Frame topBar={<TopBar />}>{children}</Frame>
}
