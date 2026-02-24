import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  LLMResponse,
  PluginContext,
  PluginHookResult,
} from './types';

interface CacheEntry {
  response: LLMResponse;
  expiresAt: number;
}

interface CacheOptions {
  ttlMs: number;
  maxEntries: number;
}

export class CachePlugin implements ChatPlugin {
  id = 'response-cache';
  description = '根据会话与问题对模型响应进行缓存，加速重复查询。';
  priority = 80;

  private readonly opts: CacheOptions;
  private readonly cache: Map<string, CacheEntry> = new Map();

  constructor(opts?: Partial<CacheOptions>) {
    this.opts = {
      ttlMs: opts?.ttlMs ?? 5 * 60_000,
      maxEntries: opts?.maxEntries ?? 500,
    };
  }

  private makeKey(context: PluginContext, request: LLMRequest): string {
    const user = context.userId ?? 'anonymous';
    const session = context.sessionId ?? 'no-session';
    const lastUserMessage: ChatMessage | undefined = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const content = lastUserMessage?.content ?? '';
    const model = request.model;
    const hashSource = `${user}|${session}|${model}|${content}`;
    // 简单 hash，避免 key 过长
    let hash = 0;
    for (let i = 0; i < hashSource.length; i += 1) {
      hash = (hash * 31 + hashSource.charCodeAt(i)) >>> 0;
    }
    return `${user}:${session}:${model}:${hash.toString(16)}`;
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
    if (this.cache.size <= this.opts.maxEntries) return;
    // 简单淘汰：超出后随机删除一些
    const removeCount = this.cache.size - this.opts.maxEntries;
    const keys = Array.from(this.cache.keys());
    for (let i = 0; i < removeCount; i += 1) {
      const k = keys[i];
      this.cache.delete(k);
    }
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const now = context.now().getTime();
    this.cleanup(now);

    const key = this.makeKey(context, request);
    const hit = this.cache.get(key);
    if (!hit) return;
    if (hit.expiresAt <= now) {
      this.cache.delete(key);
      return;
    }

    context.log.info('Cache hit for request', { key });
    return {
      response: hit.response,
      stopPropagation: true,
    };
  }

  async onAfterLLM(params: {
    context: PluginContext;
    request: LLMRequest;
    response: LLMResponse;
  }): Promise<PluginHookResult | void> {
    const { context, request, response } = params;
    const now = context.now().getTime();
    const key = this.makeKey(context, request);
    const entry: CacheEntry = {
      response,
      expiresAt: now + this.opts.ttlMs,
    };
    this.cache.set(key, entry);
    context.log.debug('Cached response', { key });
    return;
  }
}

