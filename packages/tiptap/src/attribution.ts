import { Mark, mergeAttributes } from '@tiptap/core'
import { createClipboardPlugin } from './clipboard.js'

export type SourceType = 'human-authored' | 'ai-generated' | 'ai-assisted' | 'external-quoted' | 'unknown'

export interface AttributionOptions {
  onClipsDetected?: (event: { clipHashes: string[] }) => void
  /** @deprecated Use onClipsDetected */
  onReuseDetected?: (event: { provenanceId: string }) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attribution: {
      setAttribution: (clipHash: string, sourceType?: SourceType) => ReturnType
      unsetAttribution: () => ReturnType
    }
  }
}

export const AttributionExtension = Mark.create<AttributionOptions>({
  name: 'attribution',

  addOptions() {
    return {} as AttributionOptions
  },

  addAttributes() {
    return {
      clipHash: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-clip-hash'),
        renderHTML: (attributes) => {
          if (!attributes.clipHash) return {}
          return { 'data-clip-hash': attributes.clipHash }
        }
      },
      sourceType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-source-type'),
        renderHTML: (attributes) => {
          if (!attributes.sourceType) return {}
          return { 'data-source-type': attributes.sourceType }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-clip-hash]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setAttribution:
        (clipHash: string, sourceType?: SourceType) =>
        ({ commands }) => {
          return commands.setMark('attribution', { clipHash, sourceType })
        },
      unsetAttribution:
        () =>
        ({ commands }) => {
          return commands.unsetMark('attribution')
        }
    }
  },

  addProseMirrorPlugins() {
    const onClipsDetected = this.options.onClipsDetected
      ?? (this.options.onReuseDetected
        ? (event: { clipHashes: string[] }) => {
            event.clipHashes.forEach((hash) => {
              this.options.onReuseDetected!({ provenanceId: hash })
            })
          }
        : undefined)

    return [createClipboardPlugin(onClipsDetected ? { onClipsDetected } : {})]
  }
})
