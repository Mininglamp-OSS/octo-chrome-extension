import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CornerDownRight, X } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  COMPOSER_LIMITS,
  clearDraft,
  loadDraft,
  saveDraft,
  stripInvisibleChars,
  validateAttachments,
} from "@/components/composer/composerLimits";
import { EmojiPicker } from "@/components/composer/EmojiPicker";
import { buildMentionInfo, createMentionExtension } from "@/components/composer/mention";
import { SlashCommandExtension } from "@/components/composer/slash";
import { buildChatContext } from "@/components/composer/voice/buildChatContext";
import { VoiceInputIndicator } from "@/components/composer/voice/VoiceInputIndicator";
import { formatFileSize } from "@/components/octo/FileTypeIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sendFile, sendImage, sendSticker, sendText } from "@/im/send";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { channelKey, useReplyDraft } from "@/stores/replyDraft";
import { cn } from "@/utils/cn";
import { extractErrorMsg } from "@/utils/extractErrorMsg";

interface ComposerProps {
  channelId: string;
  channelType: number;
  members?: import("@/api/schemas/member").Member[];
  /** 最近消息（给语音 chat_context 拼接，取最后 10 条） */
  messages?: import("@/im/message").MessageView[];
  /** 私聊时对方的 Member（给 memberContext 用） */
  peer?: import("@/api/schemas/member").Member;
}

interface PendingAttachment {
  id: string;
  file: File;
}

// mirror 同款 SVG path（COMPOSER_ICONS）— stroke-based 24x24 viewBox
const ICON = {
  emoji: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </>
  ),
  at: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
    </>
  ),
  attach: (
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  ),
  send: (
    <>
      <path d="M3.5 11.5L20 4l-3.5 16.5-5-7z" />
      <path d="M11.5 13.5L20 4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
} as const;

function ComposerIcon({ path, className }: { path: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

function getAttachmentBadge(file: File): string {
  if (file.type.startsWith("image/")) return "IMG";
  const dot = file.name.lastIndexOf(".");
  if (dot > 0) {
    return file.name
      .substring(dot + 1)
      .toUpperCase()
      .slice(0, 4);
  }
  return "FILE";
}

export function Composer({ channelId, channelType, members, messages, peer }: ComposerProps) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [textLength, setTextLength] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerCardRef = useRef<HTMLDivElement>(null);
  const theme = usePreferencesStore((s) => s.theme);
  const emojiTheme = theme === "system" ? "auto" : theme;
  const loginUid = useAuthStore((s) => s.state?.uid ?? "");
  const ck = channelKey(channelId, channelType);
  const reply = useReplyDraft((s) => s.byChannel.get(ck));
  const clearReply = useReplyDraft((s) => s.clear);

  // membersRef 让 mention extension 闭包始终读到最新成员列表（切换会话后立即生效）
  const membersRef = useRef(members ?? []);
  useEffect(() => {
    membersRef.current = members ?? [];
  }, [members]);

  // mention popup 打开时拦截 Enter，避免选成员时同时触发发送
  // 对照 mirror MessageInput 的 mentionActiveRef 用法
  const mentionActiveRef = useRef(false);
  // 把 handleSend 装进 ref，让 editorProps.handleKeyDown（编辑器 init 时绑定一次）总能调到最新版
  const handleSendRef = useRef<(() => void) | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "输入消息（@ 提及成员，/ 命令）…" }),
      createMentionExtension(
        () => channelType,
        () => membersRef.current,
        (active) => {
          mentionActiveRef.current = active;
        },
      ),
      SlashCommandExtension,
    ],
    onUpdate({ editor }) {
      const text = editor.getText();
      setTextLength(text.length);
      void saveDraft(channelId, channelType, JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "ProseMirror focus:outline-none [&_p]:my-0",
      },
      // ProseMirror 级别的 Enter 处理：在 mention / slash 插件 keydown 之前跑。
      // mirror MessageInput 同款，避免选 mention 时 popup onExit 同步把 ref 翻为 false 后
      // React 顶层 onKeyDown 又触发一次发送（出现「选中即发出」/「@后输入框清空」的怪现象）。
      handleKeyDown(_view, event) {
        if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          if (mentionActiveRef.current) return false; // popup 打开 → 让 mention 插件处理
          handleSendRef.current?.();
          event.preventDefault();
          return true;
        }
        return false;
      },
      handlePaste(_, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const files: File[] = [];
        for (const item of items) {
          if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length > 0) {
          void addFiles(files);
          return true;
        }
        return false;
      },
      handleTextInput(_view, _from, _to, text) {
        const cleaned = stripInvisibleChars(text);
        if (cleaned !== text) {
          if (cleaned.length === 0) return true;
          editor?.commands.insertContent(cleaned);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    void loadDraft(channelId, channelType).then((draft) => {
      if (cancelled || !editor) return;
      if (draft) {
        try {
          editor.commands.setContent(JSON.parse(draft));
        } catch {
          editor.commands.setContent(draft);
        }
      } else {
        editor.commands.clearContent();
      }
      setTextLength(editor.getText().length);
    });
    setPending([]);
    return () => {
      cancelled = true;
    };
  }, [channelId, channelType, editor]);

  function getText(): string {
    if (!editor) return "";
    return stripInvisibleChars(editor.getText()).trim();
  }

  async function addFiles(files: File[]): Promise<void> {
    const existing = pending.map((p) => p.file);
    const { accepted, rejected } = validateAttachments(existing, files);
    if (rejected.length > 0) toast.error(rejected[0]?.reason ?? "附件被拒绝");
    const list: PendingAttachment[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
    }));
    setPending((prev) => [...prev, ...list]);
  }

  async function onPickFiles(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) await addFiles(files);
    e.target.value = "";
  }

  function removePending(id: string): void {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  function insertEmoji(native: string): void {
    editor?.chain().focus().insertContent(native).run();
    setEmojiOpen(false);
  }

  function insertMentionTrigger(): void {
    if (!editor) return;
    editor.chain().focus().insertContent("@").run();
  }

  async function handleSend(): Promise<void> {
    if (sending) return;
    const text = getText();
    const attachments = pending.slice();
    if (!text && attachments.length === 0) return;
    if (text.length > COMPOSER_LIMITS.MAX_MESSAGE_LENGTH) {
      toast.error(`输入内容不能超过 ${COMPOSER_LIMITS.MAX_MESSAGE_LENGTH} 字`);
      return;
    }
    const mentionInfo = editor ? buildMentionInfo(editor.getJSON(), text) : null;
    setSending(true);
    try {
      for (const att of attachments) {
        if (att.file.type.startsWith("image/")) {
          await sendImage(channelId, channelType, att.file);
        } else {
          await sendFile(channelId, channelType, att.file);
        }
      }
      if (text) {
        const replyInfo = reply
          ? {
              messageId: reply.messageId,
              messageSeq: reply.messageSeq,
              fromUid: reply.fromUid,
              fromName: reply.fromName,
              digest: reply.digest,
              content: reply.content,
            }
          : undefined;
        await sendText(channelId, channelType, text, {
          ...(replyInfo && { replyInfo }),
          ...(mentionInfo?.uids.length && { mentionUids: mentionInfo.uids }),
          ...(mentionInfo?.all && { mentionAll: true }),
          ...(mentionInfo?.entities.length && { mentionEntities: mentionInfo.entities }),
        });
      }
      editor?.commands.clearContent();
      setPending([]);
      clearReply(ck);
      void clearDraft(channelId, channelType);
      setTextLength(0);
    } catch (err) {
      toast.error(extractErrorMsg(err) || "发送失败");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    // Enter 已经在 editorProps.handleKeyDown 里处理（避免和 mention 插件抢 Enter）。
    // 这里仅留作占位，将来要拦截 Tab / Esc 等可在此添加。
    void e;
  }

  // 每次渲染把最新 handleSend 挂到 ref 上（闭包了最新的 channelId / channelType / state）
  handleSendRef.current = () => {
    void handleSend();
  };

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void addFiles(files);
  }

  const overLimit = textLength > COMPOSER_LIMITS.MAX_MESSAGE_LENGTH;
  const canSend = !sending && !overLimit && (textLength > 0 || pending.length > 0);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: composer 容器，焦点在内层 editor
    <div
      className="octo-composer-shell octo-composer-shell-sidepanel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {reply && (
        <div className="octo-composer-reply">
          <CornerDownRight className="octo-composer-reply-icon" />
          <div className="octo-composer-reply-body">
            <div className="octo-composer-reply-name">引用 {reply.fromName}</div>
            <div className="octo-composer-reply-text">{reply.digest}</div>
          </div>
          <button
            type="button"
            className="octo-composer-reply-close"
            onClick={() => clearReply(ck)}
            title="取消引用"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: 截获 editor 冒泡的 Enter */}
      <div
        ref={composerCardRef}
        className="octo-composer wk-messageinput-box"
        onKeyDown={onKeyDown}
      >
        {pending.length > 0 && (
          <div className="octo-composer-chips">
            {pending.map((p) => (
              <div className="octo-composer-chip" key={p.id}>
                <span className="octo-composer-chip-badge">{getAttachmentBadge(p.file)}</span>
                <span className="octo-composer-chip-name" title={p.file.name}>
                  {p.file.name}
                </span>
                <span className="octo-composer-chip-size">{formatFileSize(p.file.size)}</span>
                <button
                  type="button"
                  className="octo-composer-chip-remove"
                  onClick={() => removePending(p.id)}
                  title="移除"
                >
                  <ComposerIcon className="octo-composer-chip-remove-icon" path={ICON.close} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="octo-composer-input-wrap">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: click 转发焦点到 editor */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: 内层 editor 自己处理键盘 */}
          <div className="octo-composer-editor" onClick={() => editor?.commands.focus()}>
            <EditorContent editor={editor} />
          </div>
        </div>

        <div className="octo-composer-toolbar">
          <div className="octo-composer-tools">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="octo-composer-tool" title="表情">
                  <ComposerIcon path={ICON.emoji} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto border-none p-0">
                <EmojiPicker
                  onSelect={insertEmoji}
                  theme={emojiTheme}
                  onSticker={(s) => {
                    setEmojiOpen(false);
                    void sendSticker(channelId, channelType, s).catch((err) => {
                      const msg = extractErrorMsg(err) || "发送失败";
                      toast.error(msg);
                    });
                  }}
                />
              </PopoverContent>
            </Popover>
            <button
              type="button"
              className="octo-composer-tool octo-composer-tool-mention"
              onClick={insertMentionTrigger}
              title="@提及"
            >
              <ComposerIcon path={ICON.at} />
            </button>
            <button
              type="button"
              className="octo-composer-tool"
              onClick={() => fileInputRef.current?.click()}
              title="附件"
            >
              <ComposerIcon path={ICON.attach} />
            </button>
            <VoiceInputIndicator
              editor={editor}
              members={members}
              getCurrentText={getText}
              getSelectedText={() => {
                if (!editor) return "";
                const { from, to } = editor.state.selection;
                if (from === to) return "";
                return editor.state.doc.textBetween(from, to, "\n", "\n");
              }}
              getSelectionRange={() => {
                if (!editor) return undefined;
                const { from, to } = editor.state.selection;
                if (from === to) return undefined;
                return { from, to };
              }}
              getChatContext={() =>
                buildChatContext({
                  messages: messages ?? [],
                  members: members ?? [],
                  channelType,
                  loginUid,
                  ...(peer && { peer }),
                })
              }
              anchorRef={composerCardRef}
            />
            <input ref={fileInputRef} type="file" multiple hidden onChange={onPickFiles} />
          </div>

          <div className="octo-composer-toolbar-spacer" />

          <div className={cn("octo-composer-count", overLimit && "is-over")}>
            <span className="octo-composer-count-current">{textLength}</span>
            <span> / {COMPOSER_LIMITS.MAX_MESSAGE_LENGTH}</span>
          </div>

          <button
            type="button"
            className={cn("octo-composer-send", canSend && "is-active", sending && "is-sending")}
            disabled={!canSend}
            onClick={() => void handleSend()}
            title="发送"
          >
            <ComposerIcon className="octo-composer-send-icon" path={ICON.send} />
          </button>
        </div>
      </div>
    </div>
  );
}
