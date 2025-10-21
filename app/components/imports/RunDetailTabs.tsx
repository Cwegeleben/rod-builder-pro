// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { Tabs } from '@shopify/polaris'
import type { ReactNode } from 'react'

export type TabKey = 'adds' | 'changes' | 'conflicts' | 'deletes'

export function RunDetailTabs({
  selected,
  counts,
  onSelect,
  children,
}: {
  selected: TabKey
  counts: Record<TabKey, number>
  onSelect: (key: TabKey) => void
  children: ReactNode
}) {
  const list: { id: TabKey; content: string; panelID: string }[] = [
    { id: 'adds', content: `Adds (${counts.adds})`, panelID: 'tab-adds' },
    { id: 'changes', content: `Changes (${counts.changes})`, panelID: 'tab-changes' },
    { id: 'conflicts', content: `Conflicts (${counts.conflicts})`, panelID: 'tab-conflicts' },
    { id: 'deletes', content: `Deletes (${counts.deletes})`, panelID: 'tab-deletes' },
  ]
  const idx = Math.max(
    0,
    list.findIndex(t => t.id === selected),
  )
  return (
    <Tabs
      tabs={list}
      selected={idx}
      onSelect={i => {
        const key = list[i]?.id || 'adds'
        onSelect(key)
      }}
      fitted
    >
      <div style={{ paddingTop: 8 }}>{children}</div>
    </Tabs>
  )
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
