import { Plugin, PluginKey } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

export const clipboardPluginKey = new PluginKey('attributionClipboard')

export function createClipboardPlugin(options: {
  onClipsDetected?: (event: { clipHashes: string[] }) => void
}) {
  return new Plugin({
    key: clipboardPluginKey,
    props: {
      handleDOMEvents: {
        copy(view: EditorView, e: Event) {
          const event = e as ClipboardEvent
          if (!event.clipboardData) return false

          const { state } = view
          const { from, to } = state.selection

          const slice = state.doc.slice(from, to)
          const clipHashes: string[] = []

          slice.content.descendants((node) => {
            node.marks.forEach((mark) => {
              if (mark.type.name === 'attribution' && mark.attrs.clipHash) {
                clipHashes.push(mark.attrs.clipHash)
              }
            })
          })

          if (clipHashes.length > 0) {
            const payload = {
              version: 1,
              clipHashes: Array.from(new Set(clipHashes))
            }

            event.clipboardData.setData('application/x-cliproot+json', JSON.stringify(payload))
          }

          return false
        },

        paste(view: EditorView, e: Event) {
          const event = e as ClipboardEvent
          if (!event.clipboardData) return false

          const data = event.clipboardData.getData('application/x-cliproot+json')

          if (!data) return false

          try {
            const payload = JSON.parse(data)
            const hashes: string[] = payload.clipHashes ?? payload.provenance

            if (Array.isArray(hashes) && hashes.length > 0 && options.onClipsDetected) {
              options.onClipsDetected({ clipHashes: hashes })
            }
          } catch (err) {
            console.error('Failed to parse cliproot clipboard data', err)
          }

          return false
        }
      }
    }
  })
}
