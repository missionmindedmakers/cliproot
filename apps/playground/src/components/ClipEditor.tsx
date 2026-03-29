import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { AttributionExtension } from '@cliproot/tiptap'
import type { CrpBundle } from '@cliproot/protocol'
import { useBundleStore } from '../hooks/useBundleStore'
import { readCliprootFromPasteEvent } from '../lib/clipboard-read'
import { EditorToolbar } from './EditorToolbar'
import { ProvenanceLegend } from './ProvenanceLegend'
import { SlashCommandExtension } from './SlashCommandMenu'
import '../styles/editor.css'

/**
 * Resolve a bundle's clips to {clipHash, sourceType, content} for mark application.
 */
function resolveClipAttrs(bundle: CrpBundle) {
  return (bundle.clips ?? []).map((clip) => {
    const source = bundle.sources?.find((s) => clip.sourceRefs.includes(s.id))
    return {
      clipHash: clip.clipHash,
      sourceType: source?.sourceType ?? 'unknown',
      content: clip.content ?? clip.selectors?.textQuote?.exact,
    }
  })
}

/**
 * Apply attribution marks to document text within the range [from, to).
 * For single-clip bundles (most common), marks the entire range.
 * For multi-clip, matches clip content against block text within the range.
 */
function applyMarksInRange(
  view: import('@tiptap/pm/view').EditorView,
  insertFrom: number,
  clipAttrs: { clipHash: string; sourceType: string; content?: string }[]
) {
  const { state } = view
  const markType = state.schema.marks.attribution
  if (!markType) return

  const insertTo = state.selection.from

  if (insertTo <= insertFrom) return

  // Single clip → mark the entire pasted range
  if (clipAttrs.length === 1) {
    const { clipHash, sourceType } = clipAttrs[0]!
    const tr = state.tr.addMark(
      insertFrom,
      insertTo,
      markType.create({ clipHash, sourceType })
    )
    view.dispatch(tr)
    return
  }

  // Multiple clips → match content within the pasted range
  const tr = state.tr
  let modified = false

  state.doc.nodesBetween(insertFrom, insertTo, (node, pos) => {
    if (!node.isTextblock) return
    const blockText = node.textContent
    const blockStart = pos + 1

    for (const attrs of clipAttrs) {
      if (!attrs.content) continue
      let idx = blockText.indexOf(attrs.content)
      while (idx !== -1) {
        const from = blockStart + idx
        const to = from + attrs.content.length
        if (from >= insertFrom && to <= insertTo) {
          tr.addMark(from, to, markType.create({
            clipHash: attrs.clipHash,
            sourceType: attrs.sourceType,
          }))
          modified = true
        }
        idx = blockText.indexOf(attrs.content, idx + attrs.content.length)
      }
    }
  })

  // Fallback: if no content matched, mark entire range with first clip
  if (!modified && clipAttrs.length > 0) {
    const { clipHash, sourceType } = clipAttrs[0]!
    tr.addMark(insertFrom, insertTo, markType.create({ clipHash, sourceType }))
    modified = true
  }

  if (modified) {
    view.dispatch(tr)
  }
}

export function ClipEditor() {
  const selectedClipHash = useBundleStore((s) => s.selectedClipHash)
  const clips = useBundleStore((s) => s.clips)
  const [hasSelection, setHasSelection] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      AttributionExtension.configure({
        onClipsDetected: ({ clipHashes }) => {
          // Editor-to-editor paste: select first known clip
          if (clipHashes.length > 0) {
            const store = useBundleStore.getState()
            const firstKnown = clipHashes.find((h) => store.clips.has(h))
            if (firstKnown) {
              store.selectClip(firstKnown)
            }
          }
        },
      }),
      SlashCommandExtension,
    ],
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
      handlePaste: (view, event) => {
        const result = readCliprootFromPasteEvent(event)
        if (!result.bundle) return false

        const bundle = result.bundle
        useBundleStore.getState().addBundle(`editor-paste-${Date.now()}`, bundle)

        const clipAttrs = resolveClipAttrs(bundle)
        if (clipAttrs.length === 0) return false

        // Capture cursor position before default paste inserts content
        const insertFrom = view.state.selection.from

        // Let default paste insert the content, then apply attribution marks
        setTimeout(() => {
          applyMarksInRange(view, insertFrom, clipAttrs)
        }, 0)

        return false
      },
    },
    content: '<p></p>',
  })

  // Register insert handler so ClipList can insert clips into the editor
  useEffect(() => {
    if (!editor) return

    const handler = (clipHash: string) => {
      const clip = useBundleStore.getState().clips.get(clipHash)
      if (!clip) return

      const text = clip.content ?? clip.selectors?.textQuote?.exact
      if (!text) return

      const sourceType = clip.resolvedSources[0]?.sourceType ?? 'unknown'

      // Insert text at cursor with attribution mark
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text,
          marks: [
            {
              type: 'attribution',
              attrs: { clipHash, sourceType },
            },
          ],
        })
        .run()
    }

    useBundleStore.getState().setInsertClipHandler(handler)
    return () => {
      useBundleStore.getState().setInsertClipHandler(null)
    }
  }, [editor])

  // Track whether editor has a non-empty text selection
  useEffect(() => {
    if (!editor) return

    const handler = () => {
      const { from, to } = editor.state.selection
      setHasSelection(from !== to)

      // If cursor lands on an attribution mark, select that clip
      if (from === to) {
        const marks = editor.state.selection.$from.marks()
        const attrMark = marks.find((m) => m.type.name === 'attribution')
        if (attrMark?.attrs.clipHash) {
          useBundleStore.getState().selectClip(attrMark.attrs.clipHash as string)
        }
      }
    }

    editor.on('selectionUpdate', handler)
    return () => { editor.off('selectionUpdate', handler) }
  }, [editor])

  // Sidebar clip selection → scroll editor to that mark
  useEffect(() => {
    if (!editor || !selectedClipHash) return

    let targetPos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false
      for (const mark of node.marks) {
        if (mark.type.name === 'attribution' && mark.attrs.clipHash === selectedClipHash) {
          targetPos = pos
          return false
        }
      }
    })

    if (targetPos !== null) {
      editor.chain().setTextSelection(targetPos).scrollIntoView().run()
    }
  }, [selectedClipHash, editor])

  // Apply the selected sidebar clip's attribution to the current editor selection
  const applySelectedClip = useCallback(() => {
    if (!editor || !selectedClipHash) return
    const clip = clips.get(selectedClipHash)
    if (!clip) return
    const sourceType = clip.resolvedSources[0]?.sourceType ?? 'unknown'
    editor.chain().focus().setAttribution(selectedClipHash, sourceType).run()
  }, [editor, selectedClipHash, clips])

  const selectedClip = selectedClipHash ? clips.get(selectedClipHash) : undefined
  const clipPreview = selectedClip
    ? (selectedClip.content ?? selectedClip.selectors?.textQuote?.exact ?? selectedClip.clipHash.slice(7, 19))
    : null

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor} />
      <ProvenanceLegend />
      {hasSelection && selectedClipHash && clipPreview && (
        <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/80 px-4 py-1.5">
          <button
            onClick={applySelectedClip}
            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Apply attribution
          </button>
          <span className="truncate text-xs text-gray-400">
            {clipPreview.length > 60 ? clipPreview.slice(0, 60) + '...' : clipPreview}
          </span>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-900/50">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
