import { useEffect, useMemo, useState } from 'react'
import type {
  DesignStorefrontConfig,
  DesignStorefrontOption,
  DesignStorefrontPartRole,
} from '../lib/designStudio/storefront.mock'

export type UseDesignConfigResult = {
  data: DesignStorefrontConfig | null
  loading: boolean
  error: Error | null
}

export type UseDesignOptionsResult = {
  data: DesignStorefrontOption[]
  loading: boolean
  error: Error | null
}

export function useDesignConfig(): UseDesignConfigResult {
  const [data, setData] = useState<DesignStorefrontConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    async function fetchConfig() {
      setLoading(true)
      try {
        const response = await fetch('/api/design-studio/config', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load storefront config: ${response.status}`)
        }
        const payload = (await response.json()) as { config?: DesignStorefrontConfig | null }
        if (cancelled) return
        setData(payload.config ?? null)
        setError(null)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error('Unable to load config'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchConfig()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return useMemo(() => ({ data, loading, error }), [data, loading, error])
}

export function useDesignOptions(role: DesignStorefrontPartRole | null): UseDesignOptionsResult {
  const [data, setData] = useState<DesignStorefrontOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!role) {
      setData([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const selectedRole = role
    async function fetchOptions(currentRole: DesignStorefrontPartRole) {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('role', currentRole)
        const response = await fetch(`/api/design-studio/options?${params.toString()}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load options (${response.status})`)
        }
        const payload = (await response.json()) as { options?: DesignStorefrontOption[] }
        if (cancelled) return
        setData(payload.options ?? [])
        setError(null)
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        setError(err instanceof Error ? err : new Error('Unable to load options'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchOptions(selectedRole)
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [role])

  return useMemo(() => ({ data, loading, error }), [data, loading, error])
}
