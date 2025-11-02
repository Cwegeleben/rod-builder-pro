// <!-- BEGIN RBP GENERATED: importer-review-inline-v1 -->
import { Filters, Select, InlineStack, Button } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'

export default function ReviewFilters({
  searchParams,
  onChange,
}: {
  searchParams: URLSearchParams
  onChange: (next: URLSearchParams) => void
}) {
  const [q, setQ] = useState<string>(searchParams.get('q') || '')
  const statusSelected = useMemo(() => searchParams.getAll('status'), [searchParams])

  const appliedFilters = [] as { key: string; label: string; onRemove: () => void }[]
  if (q) appliedFilters.push({ key: 'q', label: `Search: ${q}`, onRemove: () => apply({ q: '' }) })
  if (statusSelected.length)
    appliedFilters.push({
      key: 'status',
      label: `Status: ${statusSelected.join(', ')}`,
      onRemove: () => apply({ status: [] }),
    })

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <Select
          label="Status"
          labelHidden
          placeholder="All"
          options={[
            { label: 'Staged', value: 'staged' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ]}
          value={statusSelected[0] || ''}
          onChange={value => apply({ status: value ? [value] : [] })}
        />
      ),
    },
  ]

  const onQueryChange = useCallback((value: string) => setQ(value), [])
  const onQueryClear = useCallback(() => setQ(''), [])

  function apply(delta: { q?: string; status?: string[] }) {
    const next = new URLSearchParams(searchParams)
    if (delta.q !== undefined) {
      if (delta.q) next.set('q', delta.q)
      else next.delete('q')
    }
    if (delta.status !== undefined) {
      next.delete('status')
      for (const s of delta.status) next.append('status', s)
    }
    next.set('page', '1')
    onChange(next)
  }

  return (
    <Filters
      queryValue={q}
      filters={filters as unknown as { key: string; label: string; filter: JSX.Element }[]}
      appliedFilters={appliedFilters}
      onQueryChange={onQueryChange}
      onQueryClear={onQueryClear}
      onClearAll={() => apply({ q: '', status: [] })}
    >
      <InlineStack gap="200">
        <Button onClick={() => apply({ q })}>Apply</Button>
      </InlineStack>
    </Filters>
  )
}
// <!-- END RBP GENERATED: importer-review-inline-v1 -->
