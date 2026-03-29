import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
}

interface ToolbarButton {
  label: string
  action: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
}

const BUTTONS: ToolbarButton[] = [
  {
    label: 'B',
    action: (e) => { e.chain().focus().toggleBold().run() },
    isActive: (e) => e.isActive('bold'),
  },
  {
    label: 'I',
    action: (e) => { e.chain().focus().toggleItalic().run() },
    isActive: (e) => e.isActive('italic'),
  },
  {
    label: 'H1',
    action: (e) => { e.chain().focus().toggleHeading({ level: 1 }).run() },
    isActive: (e) => e.isActive('heading', { level: 1 }),
  },
  {
    label: 'H2',
    action: (e) => { e.chain().focus().toggleHeading({ level: 2 }).run() },
    isActive: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    label: 'UL',
    action: (e) => { e.chain().focus().toggleBulletList().run() },
    isActive: (e) => e.isActive('bulletList'),
  },
  {
    label: 'OL',
    action: (e) => { e.chain().focus().toggleOrderedList().run() },
    isActive: (e) => e.isActive('orderedList'),
  },
  {
    label: 'Quote',
    action: (e) => { e.chain().focus().toggleBlockquote().run() },
    isActive: (e) => e.isActive('blockquote'),
  },
  {
    label: 'Code',
    action: (e) => { e.chain().focus().toggleCodeBlock().run() },
    isActive: (e) => e.isActive('codeBlock'),
  },
  {
    label: 'HR',
    action: (e) => { e.chain().focus().setHorizontalRule().run() },
  },
]

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-1 border-b border-gray-800 px-4 py-2">
      {BUTTONS.map((btn) => (
        <button
          key={btn.label}
          onClick={() => btn.action(editor)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            btn.isActive?.(editor)
              ? 'bg-gray-600 text-white'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
