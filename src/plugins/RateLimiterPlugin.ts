import {
  ChatMessage,
  ChatPlugin,
  LLMRequest,
  PluginContext,
  PluginHookResult,
} from './types';

interface RateLimiterOptions {
  maxRequestsPerMinute: number;
  maxTokensPerMinute?: number;
}

interface Counter {
  windowStart: number;
  requests: number;
  tokens: number;
}

export class RateLimiterPlugin implements ChatPlugin {
  id = 'rate-limiter';
  description = '按用户/会话进行简单限流，防止滥用。';
  priority = 100;

  private readonly opts: RateLimiterOptions;
  private readonly perUser: Map<string, Counter> = new Map();

  constructor(opts: RateLimiterOptions) {
    this.opts = opts;
  }

  private getKey(context: PluginContext): string {
    return context.userId ?? context.sessionId ?? 'anonymous';
  }

  private estimateTokens(messages: ChatMessage[]): number {
    // 粗略估算：按 4 字/词 = 1 token 简单估算
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  private isAllowed(
    context: PluginContext,
    request: LLMRequest,
  ): { allowed: boolean; reason?: string } {
    const key = this.getKey(context);
    const now = context.now().getTime();
    const windowMs = 60_000;
    const counter =
      this.perUser.get(key) ??
      ({
        windowStart: now,
        requests: 0,
        tokens: 0,
      } as Counter);

    if (now - counter.windowStart > windowMs) {
      counter.windowStart = now;
      counter.requests = 0;
      counter.tokens = 0;
    }

    const tokens = this.estimateTokens(request.messages);
    const nextRequests = counter.requests + 1;
    const nextTokens = counter.tokens + tokens;

    if (nextRequests > this.opts.maxRequestsPerMinute) {
      return { allowed: false, reason: 'too_many_requests' };
    }
    if (
      this.opts.maxTokensPerMinute &&
      nextTokens > this.opts.maxTokensPerMinute
    ) {
      return { allowed: false, reason: 'too_many_tokens' };
    }

    counter.requests = nextRequests;
    counter.tokens = nextTokens;
    this.perUser.set(key, counter);
    return { allowed: true };
  }

  async onBeforeLLM(params: {
    context: PluginContext;
    request: LLMRequest;
  }): Promise<PluginHookResult | void> {
    const { context, request } = params;
    const check = this.isAllowed(context, request);
    if (check.allowed) return;

    context.log.warn('Rate limit exceeded', {
      userId: context.userId,
      sessionId: context.sessionId,
      reason: check.reason,
    });

    const message: ChatMessage = {
      role: 'assistant',
      content:
        '当前请求过于频繁，请稍后再试。如果你认为这是误报，可以联系管理员调整限流策略。',
    };

    return {
      response: {
        model: request.model,
        messages: [message],
      },
      stopPropagation: true,
    };
  }
}

