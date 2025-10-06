import { Banner } from '@shopify/polaris'
import { useEffect, useState } from 'react'

type HelpBannerProps = {
  id: string // used as localStorage key
  title: string
  children: React.ReactNode
  tone?: 'info' | 'success' | 'warning' | 'critical'
  learnMoreHref?: string
}

export function HelpBanner({ id, title, children, tone = 'info', learnMoreHref }: HelpBannerProps) {
  const storageKey = `helpBanner:dismissed:${id}`
  const [dismissed, setDismissed] = useState<boolean>(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey)
      setDismissed(v === '1')
    } catch {
      // ignore storage errors (embedded context restrictions etc.)
    }
  }, [])

  const onDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      // ignore
    }
  }

  if (dismissed) return null

  return (
    <div className="p-m">
      <Banner
        tone={tone}
        title={title}
        onDismiss={onDismiss}
        action={learnMoreHref ? { content: 'Learn more', url: learnMoreHref } : undefined}
      >
        <p>{children}</p>
      </Banner>
    </div>
  )
}
