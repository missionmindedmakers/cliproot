import { describe, it, expect } from 'vitest'
import { AttributionExtension, clipboardPluginKey } from './index.js'

describe('AttributionExtension', () => {
  it('has the correct name', () => {
    expect(AttributionExtension.name).toBe('attribution')
  })

  it('can be configured with onClipsDetected', () => {
    const extension = AttributionExtension.configure({
      onClipsDetected: () => {}
    })
    expect(extension.options.onClipsDetected).toBeDefined()
  })

  it('supports deprecated onReuseDetected option', () => {
    const extension = AttributionExtension.configure({
      onReuseDetected: () => {}
    })
    expect(extension.options.onReuseDetected).toBeDefined()
  })
})

describe('Clipboard Plugin', () => {
  it('has a plugin key', () => {
    expect(clipboardPluginKey).toBeDefined()
  })
})
