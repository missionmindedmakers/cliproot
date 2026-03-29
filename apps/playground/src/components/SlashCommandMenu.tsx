import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react'
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'

interface SlashCommand {
  title: string
  aliases: string[]
  action: (editor: Editor, range: Range) => void
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    title: 'Heading 1',
    aliases: ['h1', 'heading1'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    aliases: ['h2', 'heading2'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    aliases: ['h3'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    aliases: ['bullet', 'ul'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    aliases: ['numbered', 'ol'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Blockquote',
    aliases: ['quote'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Code Block',
    aliases: ['code'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Divider',
    aliases: ['divider', 'hr'],
    action: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.aliases.some((a) => a.includes(q))
  )
}

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const CommandList = forwardRef<CommandListRef, SuggestionProps<SlashCommand>>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [props.items])

    const selectItem = useCallback(
      (index: number) => {
        const item = props.items[index]
        if (item) {
          props.command(item)
        }
      },
      [props]
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + props.items.length - 1) % props.items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % props.items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (props.items.length === 0) return null

    return (
      <div className="z-50 min-w-[180px] overflow-hidden rounded border border-gray-700 bg-gray-800 shadow-lg">
        {props.items.map((item, index) => (
          <button
            key={item.title}
            onClick={() => selectItem(index)}
            className={`block w-full px-3 py-1.5 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            {item.title}
            <span className="ml-2 text-gray-500">/{item.aliases[0]}</span>
          </button>
        ))}
      </div>
    )
  }
)
CommandList.displayName = 'CommandList'

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {}
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: '/',
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props: item }) => {
          item.action(editor, range)
        },
        render: () => {
          let component: ReactRenderer<CommandListRef> | null = null
          let popup: HTMLDivElement | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              })

              popup = document.createElement('div')
              popup.style.position = 'fixed'
              popup.style.zIndex = '50'
              document.body.appendChild(popup)

              const rect = props.clientRect?.()
              if (rect && popup) {
                popup.style.left = `${rect.left}px`
                popup.style.top = `${rect.bottom + 4}px`
              }

              if (component.element && popup) {
                popup.appendChild(component.element)
              }
            },

            onUpdate: (props) => {
              component?.updateProps(props)

              const rect = props.clientRect?.()
              if (rect && popup) {
                popup.style.left = `${rect.left}px`
                popup.style.top = `${rect.bottom + 4}px`
              }
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.remove()
                component?.destroy()
                popup = null
                component = null
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },

            onExit: () => {
              popup?.remove()
              component?.destroy()
              popup = null
              component = null
            },
          }
        },
      }),
    ]
  },
})
