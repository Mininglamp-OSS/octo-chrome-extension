import { useConversations } from "@/api/queries/conversations";
import type { ConversationView } from "@/im/conversation";

/**
 * 兼容层 —— sidepanel 改用 React Query 直调 conversation/sync 后，老 caller 仍用本 hook 的形状。
 * 新代码请直接用 useConversations。
 */
export function useConversationViews(): {
  conversations: ConversationView[];
  isLoading: boolean;
  error: Error | null;
} {
  const q = useConversations();
  return {
    conversations: q.data ?? [],
    isLoading: q.isLoading,
    error: (q.error as Error | null) ?? null,
  };
}
