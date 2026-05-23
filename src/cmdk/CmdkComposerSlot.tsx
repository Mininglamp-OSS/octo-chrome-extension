import { AtSign, Paperclip, Send, Smile } from "lucide-react";
import {
  forwardRef,
  type KeyboardEvent,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { COMPOSER_LIMITS } from "@/components/composer/composerLimits";
import { cn } from "@/utils/cn";

export interface CmdkComposerHandle {
  focus: () => void;
  getText: () => string;
  setText: (s: string) => void;
}

interface CmdkComposerSlotProps {
  initialText?: string;
  sending: boolean;
  hasTarget: boolean;
  hasAttachments: boolean;
  onSubmit: (text: string) => void;
  onPickFiles: () => void;
  onPaste: (files: File[]) => void;
}

/**
 * cmdk 输入区 —— 无边框 textarea + 底部 toolbar（emoji / 📎 / @ + 字数 + ghost send）。
 * 第一版：emoji / @ 仅占位；附件按钮触发外部 file picker。
 */
export const CmdkComposerSlot = forwardRef<CmdkComposerHandle, CmdkComposerSlotProps>(
  function CmdkComposerSlot(
    { initialText = "", sending, hasTarget, hasAttachments, onSubmit, onPickFiles, onPaste },
    ref,
  ) {
    const [text, setText] = useState(initialText);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        getText: () => text,
        setText: (s: string) => setText(s),
      }),
      [text],
    );

    const active = !sending && hasTarget && (text.trim().length > 0 || hasAttachments);
    const len = text.length;
    const max = COMPOSER_LIMITS.MAX_MESSAGE_LENGTH;
    const over = len > max;
    const warn = !over && len >= max * 0.8;

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
      // 中文输入法组词中，回车是选词不是发送
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!active) return;
        onSubmit(text);
      }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>): void {
      const files = Array.from(e.clipboardData.files ?? []);
      if (files.length > 0) {
        e.preventDefault();
        onPaste(files);
      }
    }

    return (
      <div className="flex shrink-0 flex-col">
        <div className="px-3 pt-3 pb-1">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={hasTarget ? "输入消息  ·  回车发送  ·  Shift+回车换行" : "先选择目标"}
            rows={2}
            className="block max-h-[160px] min-h-[44px] w-full resize-none rounded-lg border border-(--color-border)/70 bg-(--color-background)/40 px-3 py-2 text-[14px] leading-[1.55] outline-none transition-colors placeholder:text-(--color-muted-foreground)/70 focus:border-(--color-primary)/60 focus:bg-(--color-background)/70 focus:ring-2 focus:ring-(--color-primary)/15"
          />
        </div>

        <div className="flex items-center justify-between border-t border-(--color-border)/60 bg-[linear-gradient(180deg,transparent,rgba(28,28,35,0.015))] px-2.5 py-1.5">
          <div className="flex items-center gap-0.5">
            <ToolIcon
              icon={<Smile className="h-4 w-4" />}
              label="表情"
              onClick={() => toast.message("表情面板暂未启用")}
            />
            <ToolIcon
              icon={<Paperclip className="h-4 w-4" />}
              label="附件"
              onClick={onPickFiles}
            />
            <ToolIcon
              icon={<AtSign className="h-4 w-4" />}
              label="提及"
              onClick={() => toast.message("@ 提及暂未启用")}
            />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "tabular-nums text-[11px]",
                over
                  ? "text-(--color-destructive)"
                  : warn
                    ? "text-amber-500"
                    : "text-(--color-muted-foreground)/70",
              )}
              title={`${len} / ${max}`}
            >
              {len}/{max}
            </span>
            <button
              type="button"
              disabled={!active || over}
              onClick={() => onSubmit(text)}
              title="发送 (Enter)"
              aria-label="发送"
              className={cn(
                "flex h-[30px] w-[30px] items-center justify-center rounded-md transition-colors",
                active && !over
                  ? "text-(--color-primary) hover:bg-(--color-primary)/10"
                  : "text-(--color-muted-foreground)/50",
                sending && "animate-pulse",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  },
);

function ToolIcon({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-(--color-muted-foreground) transition-colors hover:bg-(--color-muted)/70 hover:text-(--color-foreground)"
    >
      {icon}
    </button>
  );
}
