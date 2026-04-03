const STYLE_ID = 'cliproot-highlight-styles'
const HL_TAG = 'cliproot-hl'

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    cliproot-hl {
      background-color: rgba(255, 212, 0, 0.35);
      border-radius: 2px;
      cursor: pointer;
      transition: background-color 0.15s;
      display: inline;
    }
    cliproot-hl:hover {
      background-color: rgba(255, 212, 0, 0.55);
    }
    cliproot-hl[data-cliproot-focused] {
      background-color: rgba(255, 180, 0, 0.5);
      outline: 1px solid rgba(200, 140, 0, 0.6);
    }
  `
  ;(document.head ?? document.documentElement).appendChild(style)
}

/**
 * Wraps the text covered by range in <cliproot-hl> elements.
 * Returns the created wrapper elements so they can be removed later.
 */
export function highlightRange(range: Range, clipHash: string): HTMLElement[] {
  const segments = getTextSegmentsInRange(range)
  if (segments.length === 0) return []

  const created: HTMLElement[] = []

  for (const { node, start, end } of segments) {
    // Split at end first so start offset stays valid
    if (end < node.length) {
      node.splitText(end)
    }
    // Split at start — the return value is the segment we want to wrap
    const target = start > 0 ? node.splitText(start) : node

    const wrapper = document.createElement(HL_TAG) as HTMLElement
    wrapper.setAttribute('data-clip-hash', clipHash)
    target.parentNode?.insertBefore(wrapper, target)
    wrapper.appendChild(target)
    created.push(wrapper)
  }

  return created
}

/** Remove all <cliproot-hl> wrappers from the document, restoring original text nodes. */
export function removeHighlights(): void {
  const highlights = document.querySelectorAll(HL_TAG)
  const parents = new Set<Node>()

  for (const hl of highlights) {
    const parent = hl.parentNode
    if (!parent) continue

    while (hl.firstChild) {
      parent.insertBefore(hl.firstChild, hl)
    }
    parent.removeChild(hl)
    parents.add(parent)
  }

  // Merge adjacent text nodes split by wrapping
  for (const parent of parents) {
    if (parent.nodeType === Node.ELEMENT_NODE) {
      ;(parent as Element).normalize()
    }
  }
}

interface TextSegment {
  node: Text
  /** Start offset within node.textContent to wrap (before any splits). */
  start: number
  /** End offset within node.textContent to wrap (before any splits). */
  end: number
}

function getTextSegmentsInRange(range: Range): TextSegment[] {
  const segments: TextSegment[] = []
  const { startContainer, endContainer, startOffset, endOffset } = range

  // Fast path: both endpoints in the same text node
  if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
    segments.push({ node: startContainer as Text, start: startOffset, end: endOffset })
    return segments
  }

  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT)

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!rangeContainsNode(range, node)) continue

    const start = node === startContainer ? startOffset : 0
    const end = node === endContainer ? endOffset : node.length

    if (start < end) {
      segments.push({ node, start, end })
    }
  }

  return segments
}

/**
 * Returns true if the range intersects the given text node.
 * Avoids using Range.intersectsNode which has subtle edge-case behaviour.
 */
function rangeContainsNode(range: Range, node: Text): boolean {
  const nodeRange = document.createRange()
  nodeRange.selectNode(node)
  return (
    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0
  )
}
