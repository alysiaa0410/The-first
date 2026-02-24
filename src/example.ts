import {
  CachePlugin,
  ChatMessage,
  ContentFilterPlugin,
  ContextWindowPlugin,
  LanguageDetectPlugin,
  LoggingPlugin,
  ModelRouterPlugin,
  PluginContext,
  PluginManager,
  RateLimiterPlugin,
  RetryCircuitBreakerPlugin,
} from './index';

async function fakeLLMCall(request: {
  model: string;
  messages: ChatMessage[];
}): Promise<{ model: string; messages: ChatMessage[] }> {
  const last = [...request.messages].reverse()[0];
  const reply: ChatMessage = {
    role: 'assistant',
    content: `【模型 ${request.model} 的模拟回复】你刚才说的是：${last?.content}`,
  };
  return {
    model: request.model,
    messages: [...request.messages, reply],
  };
}

function createDefaultContext(): PluginContext {
  return {
    traceId: `trace-${Date.now()}`,
    userId: 'demo-user',
    sessionId: 'demo-session',
    meta: {},
    log: {
      debug: (msg, extra) => console.debug('[debug]', msg, extra ?? {}),
      info: (msg, extra) => console.info('[info]', msg, extra ?? {}),
      warn: (msg, extra) => console.warn('[warn]', msg, extra ?? {}),
      error: (msg, extra) => console.error('[error]', msg, extra ?? {}),
    },
    now: () => new Date(),
  };
}

async function main() {
  const manager = new PluginManager();

  // 注册一批插件（根据需要选择）
  manager.register(new LoggingPlugin());
  manager.register(
    new RateLimiterPlugin({
      maxRequestsPerMinute: 30,
      maxTokensPerMinute: 20_000,
    }),
  );
  manager.register(new RetryCircuitBreakerPlugin());
  manager.register(new CachePlugin());
  manager.register(
    new ContextWindowPlugin({
      maxChars: 4000,
    }),
  );
  manager.register(new ContentFilterPlugin());
  manager.register(new LanguageDetectPlugin());
  manager.register(
    new ModelRouterPlugin({
      defaultModel: 'gpt-main',
    }),
  );

  const context = createDefaultContext();
  const history: ChatMessage[] = [];

  const incoming: ChatMessage = {
    role: 'user',
    content: '你好，帮我简单介绍一下你自己？',
  };

  const response = await manager.handleMessage({
    context,
    incoming,
    history,
    baseRequest: {
      model: 'gpt-main',
      temperature: 0.7,
      maxTokens: 512,
    },
    callLLM: async (req) => {
      const r = await fakeLLMCall(req);
      return {
        model: r.model,
        messages: r.messages,
      };
    },
  });

  const final = [...response.messages].reverse()[0];
  // eslint-disable-next-line no-console
  console.log('\n=== 最终回复 ===\n');
  // eslint-disable-next-line no-console
  console.log(final?.content);
}

// 仅在直接运行 example.js 时执行
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

