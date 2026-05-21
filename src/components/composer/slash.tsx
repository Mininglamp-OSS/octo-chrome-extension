import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type Ref,
} from "react";
import tippy, { type Instance, type Props } from "tippy.js";

export interface SlashCommand {
  name: string;
  desc?: string;
  /** 触发后执行：editor 当前已删除 / 前缀，自由实现 */
  run: (editor: Editor, range: Range) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    name: "me",
    desc: "斜体动作 (/me 在敲键盘)",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertContent("* 在").run();
    },
  },
  {
    name: "shrug",
    desc: "插入 ¯\\_(ツ)_/¯",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertContent("¯\\_(ツ)_/¯").run();
    },
  },
  {
    name: "tableflip",
    desc: "插入 (╯°□°）╯︵ ┻━┻",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertContent("(╯°□°）╯︵ ┻━┻").run();
    },
  },
  {
    name: "unflip",
    desc: "插入 ┬─┬ ノ( ゜-゜ノ)",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertContent("┬─┬ ノ( ゜-゜ノ)").run();
    },
  },
  {
    name: "clear",
    desc: "清空当前输入",
    run: (editor, range) => {
      editor.chain().focus().deleteRange({ from: 0, to: range.to }).run();
    },
  },
];

interface ListProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
}

interface ListHandle {
  onKeyDown: (e: { event: KeyboardEvent }) => boolean;
}

const SlashList = forwardRef(function SlashList(
  { items, command }: ListProps,
  ref: Ref<ListHandle>,
) {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === "ArrowUp") {
        setIdx((idx + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setIdx((idx + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[idx];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-(--color-popover) px-3 py-2 text-xs text-(--color-muted-foreground) shadow-md">
        无匹配命令
      </div>
    );
  }

  return (
    <div className="max-h-64 w-56 overflow-y-auto rounded-md border bg-(--color-popover) p-1 shadow-md">
      {items.map((cmd, i) => (
        <button
          key={cmd.name}
          type="button"
          onClick={() => command(cmd)}
          className={`flex w-full flex-col rounded px-2 py-1.5 text-left text-sm ${
            i === idx ? "bg-(--color-accent)" : ""
          }`}
        >
          <span className="font-medium">/{cmd.name}</span>
          {cmd.desc && (
            <span className="text-[11px] text-(--color-muted-foreground)">{cmd.desc}</span>
          )}
        </button>
      ))}
    </div>
  );
});

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: true,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommand;
        }) => {
          props.run(editor, range);
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) =>
          COMMANDS.filter((c) => c.name.startsWith(query.toLowerCase())),
        render: () => {
          let component: ReactRenderer<ListHandle, ListProps> | null = null;
          let popup: Instance<Props>[] | null = null;
          return {
            onStart(props: {
              editor: Editor;
              clientRect?: (() => DOMRect | null) | null;
              items: SlashCommand[];
              command: (a: SlashCommand) => void;
              range: Range;
            }) {
              component = new ReactRenderer(SlashList, { props, editor: props.editor });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "top-start",
              });
            },
            onUpdate(props: {
              clientRect?: (() => DOMRect | null) | null;
              items: SlashCommand[];
              command: (a: SlashCommand) => void;
            }) {
              component?.updateProps(props as unknown as ListProps);
              if (props.clientRect && popup?.[0]) {
                popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              }
            },
            onKeyDown(p: { event: KeyboardEvent }) {
              if (p.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(p) ?? false;
            },
            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
