import { z } from "zod";
import { api } from "@/api/client";
import { Endpoints } from "@/api/endpoints";

/**
 * /voice/context 个人纠错串的模块级缓存。
 *
 * 行为对照 mirror VoiceService.getVoiceContext：
 * - 同 spaceId 5min 内不重复请求
 * - in-flight 期间多次调用合并到同一个 Promise
 * - 3s 超时降级（返回空 context，不阻塞 transcribe）
 * - clear() 通过 epoch 失效正在飞的请求，避免回填到 stale 数据
 */

const VoiceContextSchema = z.object({
  status: z.number().optional().default(0),
  has_context: z.boolean().optional().default(false),
  context: z.string().optional().default(""),
  updated_at: z.string().optional().default(""),
});
export type VoiceContext = z.infer<typeof VoiceContextSchema>;

const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 3000;

interface CacheEntry {
  data: VoiceContext;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<VoiceContext>>();
const epoch = new Map<string, number>();

const EMPTY: VoiceContext = { status: 0, has_context: false, context: "", updated_at: "" };

function bumpEpoch(spaceId: string): number {
  const next = (epoch.get(spaceId) ?? 0) + 1;
  epoch.set(spaceId, next);
  return next;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("voice context timeout")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export async function getVoiceContext(spaceId: string): Promise<VoiceContext> {
  if (!spaceId) return EMPTY;
  const cached = cache.get(spaceId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  if (cached) cache.delete(spaceId);

  const existing = inflight.get(spaceId);
  if (existing) return existing;

  const myEpoch = epoch.get(spaceId) ?? 0;
  const req = withTimeout(
    api.get(Endpoints.voiceContext, { searchParams: { space_id: spaceId } }).json(),
    TIMEOUT_MS,
  )
    .then((raw) => {
      const data = VoiceContextSchema.parse(raw);
      if ((epoch.get(spaceId) ?? 0) === myEpoch) {
        cache.set(spaceId, { data, ts: Date.now() });
      }
      return data;
    })
    .catch(() => EMPTY)
    .finally(() => {
      inflight.delete(spaceId);
    });

  inflight.set(spaceId, req);
  return req;
}

/** 清缓存（不传 spaceId 清全部）。同时把 epoch +1 让正在飞的请求结果作废 */
export function clearVoiceContextCache(spaceId?: string): void {
  if (spaceId) {
    bumpEpoch(spaceId);
    cache.delete(spaceId);
    inflight.delete(spaceId);
    return;
  }
  for (const k of new Set([...cache.keys(), ...inflight.keys()])) bumpEpoch(k);
  cache.clear();
  inflight.clear();
}
