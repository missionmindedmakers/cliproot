import type { StoredClip } from './types'

/**
 * Converts a stored clip's selectors back into a live DOM Range.
 * Tries three strategies in order, stopping at the first success.
 */
export function anchorClip(clip: StoredClip, root: Element): Range | null {
  const selectors = clip.selectors
  const exact = selectors?.textQuote?.exact ?? clip.content
  if (!exact) return null

  // Strategy 1: DOM selector + text verification
  if (selectors?.dom) {
    const range = anchorByDomSelector(selectors.dom, exact, root)
    if (range) return range
  }

  // Strategy 2: Text position offsets
  if (selectors?.textPosition) {
    const range = anchorByTextPosition(selectors.textPosition, exact, root)
    if (range) return range
  }

  // Strategy 3: Text quote search (with prefix/suffix disambiguation)
  return anchorByTextQuote(selectors?.textQuote ?? { exact }, root)
}

function anchorByDomSelector(
  dom: Record<string, string>,
  exact: string,
  root: Element
): Range | null {
  let container: Element | null = null

  if (dom.elementId) {
    container = document.getElementById(dom.elementId)
  } else if (dom.cssSelector) {
    try {
      container = root.querySelector(dom.cssSelector)
    } catch {
      // Invalid selector — fall through
    }
  }

  if (!container) return null

  return findTextInElement(exact, container)
}

function anchorByTextPosition(
  textPosition: { start: number; end: number },
  exact: string,
  root: Element
): Range | null {
  const range = offsetsToRange(root, textPosition.start, textPosition.end)
  if (!range) return null

  // Verify the extracted text roughly matches what was captured
  const rangeText = range.toString().replace(/\s+/g, ' ').trim()
  const expectedText = exact.replace(/\s+/g, ' ').trim()
  if (rangeText === expectedText || expectedText.startsWith(rangeText.slice(0, 20))) {
    return range
  }
  return null
}

function anchorByTextQuote(
  textQuote: { exact: string; prefix?: string; suffix?: string },
  root: Element
): Range | null {
  const bodyText = root.textContent ?? ''
  const { exact, prefix, suffix } = textQuote

  // Find all occurrences of the exact text
  const matches: number[] = []
  let searchFrom = 0
  while (true) {
    const idx = bodyText.indexOf(exact, searchFrom)
    if (idx === -1) break
    matches.push(idx)
    searchFrom = idx + 1
  }

  if (matches.length === 0) {
    // Fuzzy fallback: anchor on the first 40 chars of the clip text
    const fragment = exact.slice(0, 40).trim()
    if (!fragment) return null
    const idx = bodyText.indexOf(fragment)
    if (idx === -1) return null
    return offsetsToRange(root, idx, idx + exact.length)
  }

  if (matches.length === 1) {
    return offsetsToRange(root, matches[0], matches[0] + exact.length)
  }

  // Multiple matches — disambiguate with prefix/suffix context
  for (const idx of matches) {
    const prefixOk =
      !prefix || bodyText.slice(Math.max(0, idx - prefix.length), idx) === prefix
    const suffixStart = idx + exact.length
    const suffixOk =
      !suffix || bodyText.slice(suffixStart, suffixStart + suffix.length) === suffix

    if (prefixOk && suffixOk) {
      return offsetsToRange(root, idx, idx + exact.length)
    }
  }

  // No context match — return first occurrence
  return offsetsToRange(root, matches[0], matches[0] + exact.length)
}

/** Find the first occurrence of text inside an element and return a Range. */
function findTextInElement(text: string, container: Element): Range | null {
  const containerText = container.textContent ?? ''
  const idx = containerText.indexOf(text)
  if (idx === -1) return null

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charOffset = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0
  const endIdx = idx + text.length

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const nodeLen = node.textContent?.length ?? 0

    if (!startNode && charOffset + nodeLen > idx) {
      startNode = node
      startOffset = idx - charOffset
    }

    if (startNode && charOffset + nodeLen >= endIdx) {
      endNode = node
      endOffset = endIdx - charOffset
      break
    }

    charOffset += nodeLen
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  try {
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
  } catch {
    return null
  }
  return range
}

/** Convert character offsets relative to root's text content into a DOM Range. */
function offsetsToRange(root: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let charOffset = 0
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const nodeLen = node.textContent?.length ?? 0

    if (!startNode && charOffset + nodeLen > start) {
      startNode = node
      startOffset = start - charOffset
    }

    if (startNode && charOffset + nodeLen >= end) {
      endNode = node
      endOffset = end - charOffset
      break
    }

    charOffset += nodeLen
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  try {
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
  } catch {
    return null
  }
  return range
}
