;(function () {
  const ROOT_SELECTOR = '[data-rbp-design-studio-root]'
  const STATE_ATTR = 'data-rbp-design-studio-state'
  const scriptPromises = new Map()
  const manifestPromises = new Map()

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn)
    } else {
      fn()
    }
  }

  function annotate(root, state, message) {
    root.setAttribute(STATE_ATTR, state)
    if (!message) return
    const placeholder = root.querySelector('[data-rbp-design-studio-message]')
    if (placeholder) {
      placeholder.textContent = message
    }
  }

  async function fetchBootPayload(bootUrl) {
    const response = await fetch(bootUrl, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const error = new Error('Design Studio boot failed')
      error.response = response
      error.body = text
      throw error
    }
    return response.json()
  }

  function loadScriptOnce(src) {
    if (scriptPromises.has(src)) {
      return scriptPromises.get(src)
    }
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-rbp-design-studio-ui="${src}"]`)
      if (existing) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.defer = true
      script.dataset.rbpDesignStudioUi = src
      script.onload = () => resolve()
      script.onerror = event => reject(event)
      document.head.appendChild(script)
    })
    scriptPromises.set(src, promise)
    return promise
  }

  async function loadBundleFromManifest(manifestUrl) {
    if (!manifestUrl) return
    if (!manifestPromises.has(manifestUrl)) {
      const promise = fetch(manifestUrl, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error('Failed to load Design Studio manifest')
          return response.json()
        })
        .then(manifest => {
          if (!manifest || !manifest.entry) throw new Error('Invalid Design Studio manifest')
          const entryUrl = new URL(manifest.entry, manifestUrl).toString()
          return loadScriptOnce(entryUrl)
        })
      manifestPromises.set(manifestUrl, promise)
    }
    return manifestPromises.get(manifestUrl)
  }

  function mount(root) {
    if (root.__rbpDesignStudioMounted) return
    root.__rbpDesignStudioMounted = true
    const bootUrl = root.getAttribute('data-rbp-design-studio-boot-url')
    if (!bootUrl) {
      console.warn('[DesignStudio] Missing boot URL for block', root)
      annotate(root, 'missing-url', 'Design Studio is unavailable (missing boot URL).')
      return
    }

    annotate(root, 'loading')

    fetchBootPayload(bootUrl)
      .then(payload => {
        const detail = { bootUrl, payload }
        root.__rbpDesignStudioBootPackage = detail
        root.dispatchEvent(new CustomEvent('rbp:design-studio:boot', { detail }))
        const manifestUrl = root.getAttribute('data-rbp-design-studio-manifest-url')
        if (manifestUrl) {
          loadBundleFromManifest(manifestUrl).catch(error => {
            console.error('[DesignStudio] Failed to load storefront UI', error)
            annotate(root, 'boot-complete', 'Design Studio preview is unavailable. Please refresh to retry.')
          })
        } else {
          annotate(root, 'boot-complete', 'Design Studio manifest not configured yet.')
        }
      })
      .catch(error => {
        console.error('[DesignStudio] Failed to boot storefront', error)
        annotate(root, 'error', 'Design Studio is unavailable right now. Please try again later.')
      })
  }

  ready(function () {
    document.querySelectorAll(ROOT_SELECTOR).forEach(mount)
  })
})()
