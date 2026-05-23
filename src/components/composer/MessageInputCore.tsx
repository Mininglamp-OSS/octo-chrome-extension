import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  type ChangeEvent,
  type DragEvent,
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { Member } from "@/api/schemas/member";
import {
  COMPOSER_LIMITS,
  clearDraft,
  loadDraft,
  saveDraft,
  stripInvisibleChars,
  validateAttachments,
} from "@/components/composer/composerLimits";
import { EmojiPicker } from "@/components/composer/EmojiPicker";
import {
  buildMentionInfo,
  createMentionExtension,
  type MentionInfo,
} from "@/components/composer/mention";
import { SlashCommandExtension } from "@/components/composer/slash";
import type { ChatContextResult } from "@/components/composer/voice/useVoiceInput";
import { VoiceInputIndicator } from "@/components/composer/voice/VoiceInputIndicator";
import { formatFileSize } from "@/components/octo/FileTypeIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBotAvatarMap } from "@/hooks/useBotAvatarMap";
import { usePreferencesStore } from "@/stores/preferences";
import { cn } from "@/utils/cn";

interface PendingAttachment {
  id: string;
  file: File;
}

export interface MessageInputCoreSubmitPayload {
  text: string;
  mentionInfo: MentionInfo | null;
  attachments: File[];
}

export interface MessageInputCoreHandle {
  /** 把外部拖入的文件加进 pending 列表（panel 级 drop 时使用） */
  addFiles: (files: File[]) => void;
  /** 让外部主动 focus editor（cmdk 选完 target 时使用） */
  focus: () => void;
}

type Sticker = { path: string; placeholder: string; format: string; category: string };

export interface MessageInputCoreProps {
  /** mention 列表来源（私聊请传空 / undefined） */
  members?: Member[];
  /** 私聊会跳过 mention 菜单；未选 target 时可不传，菜单依赖 members 为空也会空 */
  channelType?: number;
  /** 语音转写时拼 chat context；不传则 voice 走 spaceId 缓存 */
  voiceChatContext?: () => ChatContextResult;

  /** 草稿 key；null 关闭草稿持久化 */
  draftKey?: { channelId: string; channelType: number } | null;
  placeholder?: string;
  /** disabled 时禁发送 + 隐藏语音；emoji/@/附件/输入仍可用 */
  disabled?: boolean;
  /** 默认 true；不需要语音的场景传 false（cmdk 未选 target） */
  enableVoice?: boolean;
  /** shell 外层附加 class（命名修饰，不影响布局） */
  shellClassName?: string;

  /** editor 上方插槽（reply bar / cmdk quote block） */
  headerSlot?: ReactNode;

  /**
   * 真正的发送行为由调用方注入。
   * - 抛错 = 失败：内核不清 editor/不清 attachments，仅 setSending(false)。
   *   错误文案由调用方自己 toast 后 rethrow。
   * - 成功：内核清 editor / 清 attachments / clearDraft（如有）。
   *
   * 注意：调用方 onSubmit 第一行的同步代码仍处于点击/键盘的 user activation 内
   * （cmdk 依赖这一点同步触发 chrome.sidePanel.open 保手势）。
   */
  onSubmit: (payload: MessageInputCoreSubmitPayload) => Promise<void>;
  /** 表情包贴纸；不传则不展示贴纸面板（或 EmojiPicker 内部自行 fallback） */
  onStickerSend?: (sticker: Sticker) => void;

  /** sending 状态变化回调（cmdk 用来显示发送 overlay） */
  onSendingChange?: (sending: boolean) => void;

  /** 暴露 editor 给外层（拓展用，目前 cmdk 不需要） */
  onEditorReady?: (editor: Editor | null) => void;
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

const DEFAULT_PLACEHOLDER = "";

export const MessageInputCore = forwardRef<MessageInputCoreHandle, MessageInputCoreProps>(
  function MessageInputCore(
    {
      members,
      channelType,
      voiceChatContext,
      draftKey = null,
      placeholder = DEFAULT_PLACEHOLDER,
      disabled = false,
      enableVoice = true,
      shellClassName,
      headerSlot,
      onSubmit,
      onStickerSend,
      onSendingChange,
      onEditorReady,
    }: MessageInputCoreProps,
    ref: Ref<MessageInputCoreHandle>,
  ) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [textLength, setTextLength] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerCardRef = useRef<HTMLDivElement>(null);
  const theme = usePreferencesStore((s) => s.theme);
  const emojiTheme = theme === "system" ? "auto" : theme;

  // bot 真实头像在 person channelInfo.logo 里（与 MessageList 一致）。
  const botAvatarMap = useBotAvatarMap(members);
  const botAvatarRef = useRef<Map<string, string>>(botAvatarMap);
  useEffect(() => {
    botAvatarRef.current = botAvatarMap;
  }, [botAvatarMap]);

  // 让 mention extension 闭包始终读到最新成员列表
  const membersRef = useRef(members ?? []);
  useEffect(() => {
    membersRef.current = members ?? [];
  }, [members]);
  const channelTypeRef = useRef<number>(channelType ?? 0);
  useEffect(() => {
    channelTypeRef.current = channelType ?? 0;
  }, [channelType]);

  // mention popup 打开时拦截 Enter，避免选成员时同时触发发送
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
      Placeholder.configure({ placeholder }),
      createMentionExtension(
        () => channelTypeRef.current,
        () => membersRef.current,
        (active) => {
          mentionActiveRef.current = active;
        },
        (uid) => botAvatarRef.current.get(uid),
      ),
      SlashCommandExtension,
    ],
    onUpdate({ editor }) {
      const text = editor.getText();
      setTextLength(text.length);
      if (draftKey) {
        void saveDraft(draftKey.channelId, draftKey.channelType, JSON.stringify(editor.getJSON()));
      }
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
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    onSendingChange?.(sending);
  }, [sending, onSendingChange]);

  useImperativeHandle(
    ref,
    () => ({
      addFiles: (files: File[]) => void addFiles(files),
      focus: () => editor?.commands.focus(),
    }),
    [editor],
  );

  // draft 加载：仅 draftKey 切换时生效；无 draftKey 时不清空 editor，让用户输入保留
  useEffect(() => {
    if (!editor) return;
    if (!draftKey) return;
    let cancelled = false;
    void loadDraft(draftKey.channelId, draftKey.channelType).then((draft) => {
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
  }, [draftKey?.channelId, draftKey?.channelType, editor]);

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
    if (sending || disabled) return;
    const text = getText();
    const attachments = pending.map((p) => p.file);
    if (!text && attachments.length === 0) return;
    if (text.length > COMPOSER_LIMITS.MAX_MESSAGE_LENGTH) {
      toast.error(`输入内容不能超过 ${COMPOSER_LIMITS.MAX_MESSAGE_LENGTH} 字`);
      return;
    }
    const mentionInfo = editor ? buildMentionInfo(editor.getJSON(), text) : null;
    setSending(true);
    try {
      // onSubmit 内的同步代码段还在 user activation 里，cmdk 依赖此调 chrome.sidePanel.open
      await onSubmit({ text, mentionInfo, attachments });
      // 成功 → 清场
      editor?.commands.clearContent();
      setPending([]);
      setTextLength(0);
      if (draftKey) void clearDraft(draftKey.channelId, draftKey.channelType);
    } catch {
      // 失败：不清场（保留输入和附件让用户重发），错误文案由 onSubmit 内部自行 toast
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    // Enter 已经在 editorProps.handleKeyDown 里处理；占位以便后续拦截 Tab/Esc
    void e;
  }

  // 每次渲染把最新 handleSend 挂到 ref 上（闭包了最新的 props/state）
  handleSendRef.current = () => {
    void handleSend();
  };

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void addFiles(files);
  }

  const overLimit = textLength > COMPOSER_LIMITS.MAX_MESSAGE_LENGTH;
  const canSend = !sending && !disabled && !overLimit && (textLength > 0 || pending.length > 0);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: composer 容器，焦点在内层 editor
    <div
      className={cn("octo-composer-shell", shellClassName)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {headerSlot}

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
                  onSticker={
                    onStickerSend
                      ? (s) => {
                          setEmojiOpen(false);
                          onStickerSend(s);
                        }
                      : undefined
                  }
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
            {enableVoice && !disabled && (
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
                {...(voiceChatContext && { getChatContext: voiceChatContext })}
                anchorRef={composerCardRef}
              />
            )}
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
  },
);
